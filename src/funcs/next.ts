import TelegramBot, {Message, CallbackQuery} from "node-telegram-bot-api";
import { Repository } from "typeorm";
import { User } from "../entity/User";
import { Answer } from "../entity/Answer";
import { WBRes } from "..";
import axios, {AxiosResponse} from "axios";


export class Next {
    public static async getNextFeedback(count: number, valuation: number, repo: Repository<Answer>, bot: TelegramBot, user: User): Promise< | null> {
        try {
            const res: AxiosResponse<WBRes> = await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                headers: {
                    Authorization: user.token
                },
                params: {
                    take: 10000,
                    skip: 0,
                    isAnswered: false
                }
            });
            const filtered = res.data.data.feedbacks.filter(fb => fb.productValuation === valuation);
            const feedbacks = res.data.data.feedbacks;
            if (count + 1 < filtered.length) return filtered[count];
             
        } catch (error) {
            console.log(error);
            return null;
        }
    }
}