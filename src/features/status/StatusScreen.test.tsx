import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusScreen } from "./StatusScreen";

describe("StatusScreen", () => {
  it("показывает заголовок и объяснение", () => {
    render(<StatusScreen description="Проверьте подключение." title="Нет связи" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Нет связи");
    expect(screen.getByText("Проверьте подключение.")).toBeInTheDocument();
  });

  it("держит гостя внутри бренда: реквизиты на месте", () => {
    render(<StatusScreen description="Что-то сломалось." title="Ошибка" />);

    expect(screen.getByText(/ООО «Ортус Азия»/)).toBeInTheDocument();
    expect(screen.getByText(/0\+/)).toBeInTheDocument();
  });

  it("действие отображается, когда оно есть", () => {
    render(
      <StatusScreen
        action={<button type="button">Повторить</button>}
        description="Попробуйте ещё раз."
        title="Нет связи"
      />,
    );

    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });

  it("без действия лишних кнопок не появляется", () => {
    render(<StatusScreen description="Просто сообщение." title="Готово" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("технический код показывается только когда он передан", () => {
    const { rerender } = render(<StatusScreen description="Сбой." title="Ошибка" />);
    expect(screen.queryByText(/Код:/)).not.toBeInTheDocument();

    rerender(<StatusScreen description="Сбой." reference="a1b2c3" title="Ошибка" />);
    expect(screen.getByText("Код: a1b2c3")).toBeInTheDocument();
  });

  it("маскот декоративен и не читается скринридером", () => {
    render(<StatusScreen description="Сбой." title="Ошибка" tone="trouble" />);

    // Пустой alt даёт роль presentation: Рисинка здесь украшение, её описание
    // ничего не добавляет к тексту ошибки.
    expect(screen.getByRole("presentation")).toHaveAttribute("alt", "");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
