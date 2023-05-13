import { AppDataSource } from "./data-source"
import { User } from "./entity/User"
import { Answer } from "./entity/Answer";
import TGBot from "node-telegram-bot-api"
import axios, { AxiosResponse } from "axios";
import {Configuration, OpenAIApi} from "openai"
import { Admin } from "./entity/Admin";
const bot = new TGBot('6207034141:AAERSTefTVzUGjS8oJ92WFV2GRUGEm0AUCc', {polling: true});
let signingUp: number[] = [];

export interface WBRes {data: {feedbacks: {id: string, text: string, productValuation: number, productDetails:{productName: string, supplierName: string}}[]}}


const conf = new Configuration({apiKey: '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'});
const openai = new OpenAIApi(conf);

AppDataSource.initialize().then(async () => {
    const userRepo = AppDataSource.getRepository(User);
    const adminRepo = AppDataSource.getRepository(Admin); 
    const answerRepo = AppDataSource.getRepository(Answer);
    const admins = await adminRepo.find();
    bot.onText(/\/start/, async (msg: TGBot.Message) => {
        await bot.sendMessage(msg.chat.id, `Добро пожаловать! Я Джеф Бензос - бот на основе ИИ, помогу тебе автоматизировать работу с отзывами на маркетплейсах.

        Для начала работы надо зарегистрироваться и подключить API маркетплейса. 
        
        Введи пожалуйста свое имя`);
        signingUp.push(msg.chat.id);
    });

    bot.onText(/\/admin (.+)/, async (msg: TGBot.Message, match: RegExpExecArray) => {
        if (match[1] !== 'пташкаадминистратор') return await bot.sendMessage(msg.chat.id, 'Неверный промокод админа');
        let admin = new Admin();
        admin.chatId = msg.chat.id;
        const result = await adminRepo.save(admin);
        if (!result) return await bot.sendMessage(msg.chat.id, 'Произошла ошибка');
        await bot.sendMessage(msg.chat.id, 'Чат добавлен как администраторский');
    });

    bot.onText(/(.+)/, async (msg: TGBot.Message, match: RegExpExecArray) => {
        const user = await userRepo.findOne({
            where: {
                chatId: msg.chat.id,
            },
            relations: {
                answers: true
            }
        });

        if (signingUp.find(el => el === msg.chat.id)) {
            const user = new User();
            user.name = match[1];
            user.enteredPhoneNumber = false;
            user.enteredPromo = false;
            user.enteredToken = false;
            user.chatId = msg.chat.id;
            await userRepo.save(user);
            await bot.sendMessage(msg.chat.id, 'Введите ваш номер телефона');
            signingUp = signingUp.filter(el => el !== msg.chat.id);
        }  else if (user && !user.enteredPhoneNumber) {
            user.phone = match[1];
            user.enteredPhoneNumber = true;
            await userRepo.save(user);
            await bot.sendMessage(msg.chat.id, 'Теперь введите токен ВБ');
        } else if (user && !user.enteredToken) {
            user.token = match[1];
            user.enteredToken = true;
            await userRepo.save(user);
            try {
                const res = await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks/count-unanswered', {
                    headers: {
                        Authorization: match[1]
                    }
                });
                if (res.status !== 200) throw new Error('No connection with api');
                await bot.sendMessage(msg.chat.id, `Количество необработанных отзывов: ${res.data.data.countUnanswered}`);
            } catch (error) {
                return await bot.sendMessage(msg.chat.id, 'Токен ВБ не функционирует. Вы всегда можете поменять его командой /token токен');
            }
            await bot.sendMessage(msg.chat.id, 'Для дальнейшей работы необходимо ввести промокод');
        } else if (user && !user.enteredPromo) {
            if (match[1] !== 'ранняяпташка') return await bot.sendMessage(msg.chat.id, 'Неверный промокод');
            user.enteredPromo = true;
            await userRepo.save(user);
            admins.forEach(async admin => {
                await bot.sendMessage(admin.chatId, `#новыйпользователь @${user.name}`);
            });
            try {
                const res = await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                    headers: {
                        Authorization: user.token
                    },
                    params: {
                        take: 10000,
                        skip: 0,
                        isAnswered: false
                    }
                });
                if (res.status !== 200) throw new Error('Api problem');
                if (res.data.data.feedbacks.length === 0) return await bot.sendMessage(msg.chat.id, 'На данный момент неотвеченных отзывов нет', {
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
                });
                const five = res.data.data.feedbacks.filter(feedback => feedback.productValuation === 5);
                const four = res.data.data.feedbacks.filter(feedback => feedback.productValuation === 4);
                const three = res.data.data.feedbacks.filter(feedback => feedback.productValuation === 3);
                const two = res.data.data.feedbacks.filter(feedback => feedback.productValuation === 2);
                const one = res.data.data.feedbacks.filter(feedback => feedback.productValuation === 1);
                let opts = [];
                const fb = [five, four, three, two, one];
                fb.forEach(el => {
                    if (el.length > 0) opts.push([{
                        text: el[0].productValuation,
                        callback_data: `repl-${el[0].productValuation}-0`,
                    }]);
                })
                await bot.sendMessage(msg.chat.id, `У тебя ${res.data.data.feedbacks.length} необработанных отзывов. Из них:
                    5 звезд - ${five.length}
                    4 звезды - ${four.length}
                    3 звезды - ${three.length}
                    2 звезды -  ${two.length}
                    1 звезда - ${one.length}
                    На какие ответить?
                `, {
                    reply_markup: {
                        inline_keyboard: opts
                    }
                });
            } catch (error) {
                console.log(error);
                return await bot.sendMessage(msg.chat.id, 'При запросе в ВБ произошла ошибка', {
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
                });
            }
        } else if (user?.answers.find(el => el.waitingForResponse === true)) {
            const text: string = msg.text;
            const answer = user?.answers.find(el => el.waitingForResponse === true);
            answer.waitingForResponse = false;
            answer.text = text;
            await answerRepo.save(answer);
            await bot.sendMessage(msg.chat.id, 'Отзыв отредактирован и отправлен', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                'text': 'Следующий',
                                'callback_data': `repl-${answer.valuation}-${answer.count + 1}`
                            }
                        ]
                    ]
                }
            });
        } 
    });

    bot.on('callback_query',async  (q: TGBot.CallbackQuery) => {
        const user = await userRepo.findOne({
            where: {
                chatId: q.from.id
            }
        });
        if (q.data === 'answer') {
            try {
                const res = await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                    headers: {
                        Authorization: user.token
                    },
                    params: {
                        take: 10000,
                        skip: 0,
                        isAnswered: false
                    }
                });
                if (res.status !== 200) throw new Error('Api problem');
                if (res.data.data.feedbacks.length === 0) return await bot.sendMessage(q.from.id, 'На данный момент неотвеченных отзывов нет', {
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
                });
                const five = res.data.data.feedbacks.filter(feedback => feedback.productValuation === 5);
                const four = res.data.data.feedbacks.filter(feedback => feedback.productValuation === 4);
                const three = res.data.data.feedbacks.filter(feedback => feedback.productValuation === 3);
                const two = res.data.data.feedbacks.filter(feedback => feedback.productValuation === 2);
                const one = res.data.data.feedbacks.filter(feedback => feedback.productValuation === 1);
                let opts = [];
                const fb = [five, four, three, two, one];
                fb.forEach(el => {
                    if (el.length > 0) opts.push([{
                        text: el[0].productValuation,
                        callback_data: `repl-${el[0].productValuation}-0`,
                    }]);
                })
                await bot.sendMessage(q.from.id, `У тебя ${res.data.data.feedbacks.length} необработанных отзывов. Из них:
                    5 звезд - ${five.length}
                    4 звезды - ${four.length}
                    3 звезды - ${three.length}
                    2 звезды -  ${two.length}
                    1 звезда - ${one.length}
                    На какие ответить?
                `, {
                    reply_markup: {
                        inline_keyboard: opts
                    }
                });
            } catch (error) {
                console.log(error);
                return await bot.sendMessage(q.from.id, 'При запросе в ВБ произошла ошибка', {
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
                });
            }
        } else if (/repl-(.+)-(.+)/.test(q.data)) {
            try {
                const number = +(/repl-(.+)-(.+)/.exec(q.data)[2]);
                const valuation = +(/repl-(.+)-(.+)/.exec(q.data)[1]);
                const res: AxiosResponse<WBRes> = await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                    headers: {
                        Authorization: user.token
                    },
                    params: {
                        take: 10000,
                        skip: 0,
                        isAnswered: false,
                        order: "dateDesc"
                    }
                });
                if (res.data.data.feedbacks.length - number === 0) return await bot.sendMessage(q.from.id, 'Вы ответили на все отзывы.', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Ответить ещё раз',
                                    callback_data: 'answer'
                                }
                            ]
                        ]
                    }
                })
                const gptRes = await openai.createChatCompletion({
                    model: 'gpt-3.5-turbo',
                    temperature: 0,
                    messages: [
                        {
                            role: "system",
                            content: "Ты - продавец. Ты получишь отзыв в формате JSON. Твоя задача - коротко ответить на него."
                        },
                        {
                            role: "user",
                            content: JSON.stringify(res.data.data.feedbacks.filter(el => el.productValuation === valuation)[0 + number])
                        }
                    ]
                });
  
                const filtered = res.data.data.feedbacks.filter(el => el.productValuation === valuation)[0 + number]

                const answer = new Answer();
                answer.fbId = filtered.id;
                answer.user = user;
                answer.text = gptRes.data.choices[0].message.content;
                answer.count = number;
                answer.valuation = valuation;
                await answerRepo.save(answer);
                
                await bot.sendMessage(q.from.id, `
                Наименование товара: ${filtered.productDetails.productName}
                Оценка: ${filtered.productValuation}
                Отзыв: ${filtered.text}
                Ответ ИИ: ${gptRes.data.choices[0].message.content}
                `, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Опубликовать',
                                    callback_data: `publish-${answer.id}-${filtered.productValuation}`
                                }
                            ],
                            [
                                {
                                    text: 'Сначала отредактировать',
                                    callback_data: `edit-${answer.id}-${filtered.productValuation}`
                                }
                            ],
                            [
                                {
                                    text: 'Не публиковать',
                                    callback_data: `do-not-publish-${answer.id}`
                                }
                            ]
                        ]
                    }
                });

                 if (res.data.data.feedbacks.length - number !== 0) {
                    await bot.sendMessage(q.from.id, 'Отзывы закончились.', {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: 'Ответить ещё раз',
                                        callback_data: 'answer'
                                    }
                                ]
                            ]
                        }
                    });
                }

            } catch (error) {
                console.log(error);
            }
        } else if (/edit-(.+)-(.+)/.test(q.data)) {
            const match = /edit-(.+)-(.+)/.exec(q.data);
            const answer = await answerRepo.findOne({
                where: {
                    id: +match[1]
                }
            });
            answer.waitingForResponse = true;
            await answerRepo.save(answer);
            await bot.sendMessage(q.from.id, 'Отправьте мне новый текст ответа');
        } else if (/^publish-(.+)-(.+)$/.test(q.data)) {
            const execArray: RegExpExecArray = /publish-(.+)-(.+)/.exec(q.data);
            const answer = await answerRepo.findOne({
                where: {
                    id: +execArray[1]
                }
            });
            answer.waitingForConfirmation = true;
            await answerRepo.save(answer);
            await bot.sendMessage(q.from.id, 'Точно опубликовать?', {
                reply_markup: {
                    inline_keyboard:[
                        [
                            {
                                text: 'Да',
                                callback_data: `confirm`
                            }, 
                            {
                                text: 'Нет',
                                callback_data: `do-not-publish-${answer.id}`
                            }
                        ]
                    ]
                }
            });
        } else if (/confirm/.test(q.data)) {
            const answer = await answerRepo.findOne({
                where: {
                    waitingForConfirmation: true
                }
            });
            if (!answer) return await bot.sendMessage(q.from.id, 'Ответ не найден');
            await bot.sendMessage(q.from.id, 'Отзыв отправлен', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Следующий',
                                callback_data: `repl-${answer.valuation}-${answer.count + 1}`
                            }
                        ]
                    ]
                }
            });
            admins.forEach(async a => {
                await bot.sendMessage(a.chatId, `#ответсогласованотправлен`)
            })
        } else if (/^do-not-publish-(.+)$/.test(q.data)) {
            console.log(q.data);
            const match = /do-not-publish-(.+)/.exec(q.data);
            console.log(match[1]);
            const answer = await answerRepo.findOne({
                where: {
                    id: +match[1]
                }
            });
            console.log(answer);
            await bot.sendMessage(q.from.id, 'Ответ удалён', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Следующий',
                                callback_data: `repl-${answer.valuation}-${answer.count+1}`
                            }
                        ]
                    ]
                }
            });
            const result = await answerRepo.delete(answer);
        }
    });
}).catch(error => console.log(error))
