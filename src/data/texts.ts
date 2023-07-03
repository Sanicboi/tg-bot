import {AxiosResponse} from "axios";
import {IOrder, ISale} from "../index";

export const TEXT_REPORT = (sales: ISale[], orders: IOrder[], cancellations: IOrder[], refunds: ISale[]): string => {
    let rows: string[] = [
        `🛒 Заказы: ${orders.length} на ${orders.reduce((prev, el) => prev + el.totalPrice * (1 - el.discountPercent/100), 0).toLocaleString('ru-RU', {maximumFractionDigits: 2})}₽`,
        `❌ Отмененных: ${cancellations.length} на ${cancellations.reduce((prev, el) => prev + el.totalPrice, 0).toLocaleString('ru-RU', {maximumFractionDigits: 2})}₽`,
        `💸 Продажи: ${sales.filter(el => el.saleID.startsWith('S') || el.saleID.startsWith('D')).length || 0} на ${sales.reduce((prev, el) => prev+ el.priceWithDisc, 0).toLocaleString('ru-RU', {maximumFractionDigits: 2}) || 0}₽`,
        `↩️ Возвраты: ${refunds.length}`
    ];

    return rows.join('\n');
}