// Reconciliation uses Luân’s original Vietnamese number format only.
// Do not import Luân’s other UC01 model/state into the five-UC project.
export const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n)
