import { Repository } from "typeorm";
import { AnswerWrapper } from "../entity/Answer";
import { Ifeedback, Iskipped, WBRes } from "..";
import axios, { AxiosResponse } from "axios";
import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api";
import { Answer } from "../entity/Answer";
import { User } from "../entity/User";
import { OpenAIApi } from "openai";
import { Admin } from "../entity/Admin";

export class Bot {
    public static async home(msg: CallbackQuery, bot: TelegramBot, user: User) {
        try {
            const response: AxiosResponse<WBRes> = await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                headers: {
                    Authorization: user.token
                },
                params: {
                    order: "dateDesc",
                    isAnswered: false,
                    take: 10000,
                    skip: 0
                }
            });
            let keyboard: {text: string, callback_data: string}[][] = [];
            for (let i: number = 5; i >=1; i--) {
                if (response.data.data.feedbacks.find(feedback => feedback.productValuation === i)) {
                    keyboard.push([{
                        text: `${i} ${i === 1 ? "звезда" : (i === 5 ? "звезд" : "звезды")}`,
                        callback_data: `reply-${i}`,
                    }])
                }
            }
            await bot.sendMessage(msg.from.id, `У вас неотвеченных отзывов: ${response.data.data.feedbacks.length}\nИз них:\n   5 звезд: ${filterByValuation(response.data, 5).length}\n   4 звезды: ${filterByValuation(response.data, 4).length}\n   3 звезды: ${filterByValuation(response.data, 3).length}\n   2 звезды: ${filterByValuation(response.data, 2).length}\n   1 звезда: ${filterByValuation(response.data, 1).length}\n На какие ответить?
            `, {
                reply_markup: {
                    inline_keyboard: [...keyboard, [
                        {
                            text: 'Запросить еще раз',
                            callback_data: 'answer'
                        }
                    ]]
                }
            });
        } catch (error) {
            console.log(error);
            await bot.sendMessage(msg.from.id, 'Произошла ошибка', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Запросить ещё раз',
                                callback_data: 'answer'
                            }
                        ]
                    ]
                }
            })
        }
    }
    public static async reply(bot: TelegramBot, repo: Repository<Answer>, skipped: Iskipped[], user: User, openai: OpenAIApi, q: CallbackQuery, valuation: number) {
        try {
            const res: AxiosResponse<WBRes> = await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                headers: {
                    Authorization: user.token
                },
                params: {
                    order: "dateDesc",
                    isAnswered: false,
                    take: 10000,
                    skip: 0
                }
            });
            if (res.data.data.feedbacks.length === 0) return await bot.sendMessage(q.from.id, 'Отзывов нет', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Запросить еще раз',
                                callback_data: 'answer'
                            }
                        ]
                    ]
                }
            });
            const filtered = filterByValuation(res.data, valuation).filter(el => {
                return !(skipped.filter(e => e.userId === user.id).map(e => e.fbId).find(e => e === el.id));
            });
            let keyboard = [];
            for (let i : number = 5; i >= 1; i--) {
                if (filterByValuation(res.data, i).length > 0) {
                    keyboard.push([
                        {
                            text: `${i} ${i === 1 ? "звезда": (i === 5 ? "звезд" : "звезды")}`,
                            callback_data: `reply-${i}`
                        }
                    ])
                }
            }
            if (keyboard.length === 0) {
                return await bot.sendMessage(q.from.id, 'Вы ответили на все отзывы', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Запросить еще раз',
                                    callback_data: 'answer'
                                }
                            ]
                        ]
                    }
                });
            }
            if (filtered.length === 0) {
                return await bot.sendMessage(q.from.id, 'Вы ответили на все отзывы этой категории. На какие ответить теперь?', {
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
            }
            const current = filtered[0];
            const answer = await AnswerWrapper.create(current.id, JSON.stringify(current), current.productDetails.nmId,  valuation, user, repo, openai);
            if (!answer) throw new Error('Something went wrong');
            await bot.sendMessage(q.from.id, `
            Наименование товара: ${current.productDetails.productName}
            Оценка: ${current.productValuation}
            Отзыв: ${current.text}
            Ответ ИИ:
            `);
            await bot.sendMessage(q.from.id, `
                ${answer.text}
            `, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Сгенерировать другой вариант',
                                callback_data: q.data
                            }
                        ],
                        [
                            {
                                text: 'Опубликовать',
                                callback_data: `publish-${answer.id}`
                            }
                        ],
                        [
                            {
                                text: 'Сначала отредактировать',
                                callback_data: `edit-${answer.id}`,
                            }
                        ],
                        [
                            {
                                text: 'Не публиковать',
                                callback_data: `reject-${answer.id}`
                            }
                        ]
                    ]
                },
            });
        } catch (error) {
            console.log(error);
            await bot.sendMessage(q.from. id, 'Произошла ошибка', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Ответить заново',
                                callback_data: 'answer'
                            }
                        ]
                    ]
                }
            })
        }
    }
    public static async publish(q: CallbackQuery, bot: TelegramBot, id: number, repo: Repository<Answer>){
        try {
            const answer = await repo.findOneBy({id});
            await bot.sendMessage(q.from.id, 'Вы уверены? Точно опубликовать этот ответ?', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Да',
                                callback_data: `confirm-${answer.id}`
                            }
                        ], 
                        [
                            {
                                text: 'Нет',
                                callback_data: `reject-${answer.id}`
                            }
                        ]
                    ]
                }
            });
        } catch (error) {
            console.log(error);
            await bot.sendMessage(q.from.id, 'Произошла ошибка', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'На главную',
                                callback_data: `answer`
                            }
                        ]
                    ]
                }
            });
        }
    }
    public static async confirm(user: User, id: number, admins: Admin[], bot: TelegramBot, q: CallbackQuery, repo: Repository<Answer>) {
        try {
            const result = await AnswerWrapper.confirm(id, repo);
            if (!result) throw new Error();
            await bot.sendMessage(q.from.id, 'Ответ отправлен', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Перейти к следующему отзыву',
                                callback_data: `reply-${result.valuation}`
                            }
                        ]
                    ]
                }
            });
            admins.forEach(async admin => {
                await bot.sendMessage(admin.chatId, `#ответсогласованотправлен @${user.name}`);
            });
        } catch (error) {
            console.log(error);
            await bot.sendMessage(q.from.id, 'Произошла ошибка', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'На главную',
                                callback_data: 'answer'
                            }
                        ]
                    ]
                }
            });
        }
    }
    public static async remove(q: CallbackQuery, id: number, user: User, bot: TelegramBot, repo: Repository<Answer>, skipped: Iskipped[]) {
        try {
            const result = await AnswerWrapper.destroy(id, repo);
            if (!result) throw new Error();
            skipped.push({
                userId: user.id,
                fbId: result.fbId
            });
            await bot.sendMessage(q.from.id, 'Ответ не опубликован', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Перейти к следующему отзыву',
                                callback_data: `reply-${result.valuation}`
                            }
                        ]
                    ]
                }   
            })
        } catch (error) {
            console.log(error);
            await bot.sendMessage(q.from.id, 'Произошла ошибка', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'На главную',
                                callback_data: 'answer'
                            }
                        ]
                    ]
                }
            });
        }
    }
    public static async edit(msg: Message, admins: Admin[], bot: TelegramBot, user: User, text: string,  repo: Repository<Answer>) {
        try {
            const result = await AnswerWrapper.change(text, repo);
            if (!result) throw new Error();
            await bot.sendMessage(msg.chat.id, 'Точно опубликовать?', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Да',
                                callback_data: `confirm-${result.id}`
                            }
                        ],
                        [
                            {
                                text: 'Нет',
                                callback_data: `reject-${result.id}`
                            }
                        ]
                    ]
                }
            });
            admins.forEach(async admin => {
                await bot.sendMessage(admin.chatId, `#ответизменен @${user.name}`);
            });
        } catch (error) {
            console.log(error);
            await bot.sendMessage(msg.chat.id, 'Произошла ошибка', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'На главную',
                                callback_data: 'answer'
                            }
                        ]
                    ]
                }
            });
        }
    }

    public static async newHome(msg: TelegramBot.Message, bot: TelegramBot, user: User) {
        try {
            const response: AxiosResponse<WBRes> = await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                headers: {
                    Authorization: user.token
                },
                params: {
                    order: "dateDesc",
                    isAnswered: false,
                    take: 10000,
                    skip: 0
                }
            });
            let keyboard: {text: string, callback_data: string}[][] = [];
            for (let i: number = 5; i >=1; i--) {
                if (response.data.data.feedbacks.find(feedback => feedback.productValuation === i)) {
                    keyboard.push([{
                        text: `${i} ${i === 1 ? "звезда" : (i === 5 ? "звезд" : "звезды")}`,
                        callback_data: `reply-${i}`,
                    }])
                }
            }
            await bot.sendMessage(msg.chat.id, `У вас неотвеченных отзывов: ${response.data.data.feedbacks.length}\nИз них:\n   5 звезд: ${filterByValuation(response.data, 5).length}\n   4 звезды: ${filterByValuation(response.data, 4).length}\n   3 звезды: ${filterByValuation(response.data, 3).length}\n   2 звезды: ${filterByValuation(response.data, 2).length}\n   1 звезда: ${filterByValuation(response.data, 1).length}\n На какие ответить?
            `, {
                reply_markup: {
                    inline_keyboard: [...keyboard, [
                        {
                            text: 'Запросить еще раз',
                            callback_data: 'answer'
                        }
                    ]]
                }
            });
        } catch (error) {
            console.log(error);
            await bot.sendMessage(msg.chat.id, 'Произошла ошибка', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Запросить ещё раз',
                                callback_data: 'answer'
                            }
                        ]
                    ]
                }
            })
        }
    }
}

function filterByValuation(res: WBRes, val: number): Ifeedback[] {
    return res.data.feedbacks.filter(f => f.productValuation === val);
}