import { AppDataSource } from "./data-source"
import { User } from "./entity/User"
import { Answer } from "./entity/Answer";
import TGBot from "node-telegram-bot-api"
import axios, { AxiosError, AxiosResponse } from "axios";
import {Configuration, OpenAIApi} from "openai"
import { Admin } from "./entity/Admin";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

//TODO: change to env variable
const bot = new TGBot('5990028065:AAGQx03OOnmW_9HYWEJRzPwvYQdtvBwR-QM' /*'6207034141:AAERSTefTVzUGjS8oJ92WFV2GRUGEm0AUCc'*/, {polling: true});
let signingUp: number[] = [];
export interface Ifeedback {id: string, text: string, productValuation: number, productDetails:{productName: string, nmId: number, supplierName: string}};
export interface WBRes {data: {feedbacks: Ifeedback[]}}
export interface Iskipped {
    fbId: string,
    userId: number
}

export interface IOrder {
    totalPrice: number;
    discountPercent: number;
    isCancel: boolean;
    lastChangeDate: string;
}

export interface ISale {
    forPay: number;
    saleID: string;
    priceWithDisc: number;
}
import { Bot } from "./funcs/bot";
import {TEXT_REPORT} from "./data/texts";

let skipped: Iskipped[] = [];
let enteringToken: number[] = [];
const conf = new Configuration({apiKey: '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'});
const openai = new OpenAIApi(conf);

AppDataSource.initialize().then(async () => {
    const userRepo = AppDataSource.getRepository(User);
    const adminRepo = AppDataSource.getRepository(Admin); 
    const answerRepo = AppDataSource.getRepository(Answer);

    await bot.setMyCommands([
        {
            command: '/start',
            description: 'Запустить бота'
        },
        {
            command: '/answer',
            description: '🫶 Ответы на отзывы'
        },
        {
            command: '/report',
            description: '📊 Сводный отчет за сегодня'
        },
        {
            command: '/month_report',
            description: '📊 Сводный отчет за 30 дней'
        },
        {
            command: '/me',
            description: '👤 Пользователь'
        },
        {
            command: '/improvements',
            description: '💡 Если у вас есть предложения, комментарии или пожелания по улучшению нашего сервиса, пожалуйста, направьте их в наш Telegram-бот по адресу https://t.me/MPfact_SupportBot.'
        },
    ]);



    bot.onText(/\/improvements/, async (msg: TGBot.Message) => {
        await bot.sendMessage(msg.chat.id, 'Если у вас есть предложения, комментарии или пожелания по улучшению нашего сервиса, пожалуйста, направьте их в наш Telegram-бот по адресу https://t.me/MPfact_SupportBot.');
    });

    // bot.onText(/\/chat/, async (msg: TGBot.Message) =>{
    //     await bot.sendMessage(msg.chat.id, 'https://t.me/mpexpert_chat');
    // })


    bot.onText(/\/start/, async (msg: TGBot.Message) => {
        const user = await userRepo.findOneBy({chatId: String(msg.chat.id)});
        if (!user) {
            await bot.sendMessage(msg.chat.id, `Добро пожаловать!

Бот MPfact на основе ИИ, поможет:

1. Автоматизировать работу с отзывами на маркетплейсах.
2. Контролировать продажи на маркетплейсах


🔥 Генерируйте ответы на отзывы в два клика и экономьте время для других задач!

Для начала работы надо зарегистрироваться и подключить API маркетплейса. 
            
Введи пожалуйста свое имя

`);
            signingUp.push(msg.chat.id);
        } else {
            let keyboard: TGBot.InlineKeyboardButton[][] = [];
            if (user.enteredStats) {
                keyboard.push([{
                    text: 'Получить отчет',
                    callback_data: 'report'
                }]);
            } else {
                keyboard.push([{
                    text: 'Ввести токен статистики (для отчетов):',
                    callback_data: 'enter-stats'
                }]);
            }
            if (user.enteredToken) {
                keyboard.push([{
                    text: 'Ответить на отзывы',
                    callback_data: 'answer'
                }]);
            } else {
                keyboard.push([{
                    text: 'Ввести стандартный токен (для отзывов):',
                    callback_data: 'enter-token'
                }]);
            }
            await bot.sendMessage(msg.chat.id,  `Добро пожаловать в бот MPfact, ${user.name}\nВаш ID: ${user.chatId}\nДата регистрации: ${user.signupDate.toLocaleDateString()}\nТокен стандартный для отзывов:\n${user.enteredToken ? '✅Введен' : '❌Отсутствует'}\nТокен статистики для отчетов:\n${user.enteredStats ? '✅Введен' : '❌Отсутствует'}\n${user.supplierName ? `Имя поставщика: ${user.supplierName}` : ``}\n\nИнструкция по поиску и добавлению токенов здесь: https://telegra.ph/Instrukciya-po-dobavleniyu-tokenov-v-bot-MPfact-06-27`, {
                reply_markup: {
                    inline_keyboard: keyboard
                },
                disable_web_page_preview: true
            });
        }
    });
// TODO: copy code (DRY)
bot.onText(/\/me/, async (msg: TGBot.Message) => {
        const user = await userRepo.findOne({where: {chatId: String(msg.chat.id)}, relations: {
            answers: true
        }});
	if (!user) return await bot.sendMessage(msg.chat.id, 'Вы не авторизованы');
    let keyboard: TGBot.InlineKeyboardButton[][] = [];
    if (!user.enteredStats) keyboard.push([
        {
            text: 'Ввести токен статистики (для отчетов):',
            callback_data: 'enter-stats'
        }
    ])
    if (!user.enteredToken) keyboard.push([
        {
            text: 'Ввести стандартный токен (для отзывов):',
            callback_data: 'enter-token'
        }
    ]);
	await bot.sendMessage(msg.chat.id,  `Добро пожаловать в бот MPfact, ${user.name}\nВаш ID: ${user.chatId}\nДата регистрации: ${user.signupDate.toLocaleDateString()}\nТокен стандартный для отзывов:\n${user.enteredToken ? '✅Введен' : '❌Отсутствует'}\nТокен статистики для отчетов:\n${user.enteredStats ? '✅Введен' : '❌Отсутствует'}\n${user.supplierName ? `Имя поставщика: ${user.supplierName}` : ``}\n\nИнструкция по поиску и добавлению токенов здесь: https://telegra.ph/Instrukciya-po-dobavleniyu-tokenov-v-bot-MPfact-06-27`,{
        reply_markup: {
            inline_keyboard: keyboard
        },
        disable_web_page_preview: true
    });
});

bot.onText(/(.)+/, async (msg: TGBot.Message) => {
        const user = await userRepo.findOne({where: {chatId: String(msg.chat.id)}, relations: {
            answers: true
        }});
        const admins = await adminRepo.find();

        if (msg.text.startsWith('/') && user) {
            if (user.enteringToken) user.enteringToken = false;
            if (user.enteringStats) user.enteringStats = false;
            await userRepo.save(user);
        }

        if (signingUp.find(el => el === msg.chat.id) && !user) {
            const newUser = new User();
            newUser.name = msg.text || ''; // TODO: правка номер 1
            newUser.chatId = String(msg.chat.id);
            newUser.tgName = msg.from?.username || msg.from?.first_name || '';
            newUser.signupDate = new Date();
            newUser.enteredPromo = false;
            newUser.enteredStats = false;
            newUser.enteringStats = false;
            newUser.special = false;
            newUser.enteringToken = false;
            await userRepo.save(newUser);
            await bot.sendMessage(msg.chat.id, 'Для дальнейшей работы введите промокод', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "У меня нет промокода",
                                callback_data: 'no-promo',
                            }
                        ]
                    ]
                }
            });
        } else if (user && !user.enteredPromo && !user.registeredWithoutPromo) {
            if (msg.text === 'special23') {
                user.special = true;
                user.enteredPromo = true;
                await userRepo.save(user);
            } else if (msg.text === 'ранняяпташка') {
                user.enteredPromo = true;
                await userRepo.save(user);
            } else {
                return await bot.sendMessage(msg.chat.id, 'Неверный промокод');
            }
            // TODO: убрать DRY
            await bot.sendMessage(msg.chat.id, `Добро пожаловать в бот MPfact, ${user.name}\nВаш ID: ${user.chatId}\nДата регистрации: ${user.signupDate.toLocaleDateString()}\nТокен стандартный для отзывов:\n${user.enteredToken ? '✅Введен' : '❌Отсутствует'}\nТокен статистики для отчетов:\n${user.enteredStats ? '✅Введен' : '❌Отсутствует'}\n${user.supplierName ? `Имя поставщика: ${user.supplierName}` : ``}\n\nИнструкция по поиску и добавлению токенов здесь: https://telegra.ph/Instrukciya-po-dobavleniyu-tokenov-v-bot-MPfact-06-27`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Ввести токен статистики (для отчетов):',
                                callback_data: 'enter-token'
                            }
                        ],
                        [
                            {
                                text: 'Ввести стандартный токен (для отзывов):',
                                callback_data: 'enter-stats'
                            }
                        ]
                    ]
                },
                disable_web_page_preview: true
            });
            admins.forEach(async admin => {
                await bot.sendMessage(+admin.chatId, `Новый пользователь ${user.name}, ник в тг: @${msg.from?.username || msg.from?.first_name} Промокод: ${user.special ? 'special23' : 'ранняяпташка'}`)
            });
        } else if (user && user.enteringStats) {
            try {
                await axios.get('https://statistics-api.wildberries.ru/api/v1/supplier/orders', {
                    params: {
                        dateFrom: (new Date()).toISOString()
                    },
                    headers: {
                        'Authorization': msg.text
                    }
                });
                user.enteringStats = false;
                user.enteredStats = true;
                user.statsToken = msg.text || '';
                await userRepo.save(user);
                await bot.sendMessage(msg.chat.id, 'Токен введен', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'На главную',
                                    callback_data: 'start'
                                }
                            ]
                        ]
                    }
                })
            } catch (error) {
                console.log(error);
                await bot.sendMessage(msg.chat.id, `Данный токен не функционирует. Пожалуйста введите корректный токен.`);
                user.enteringStats = false;
                await userRepo.save(user);
            }
        } else if (user && user.enteringToken) {
            try {
                await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks/count-unanswered', {
                    headers: {
                        'Authorization': msg.text
                    }
                });
                user.enteringToken = false;
                user.enteredToken = true;
                user.token = msg.text || '';
                await userRepo.save(user);
                await bot.sendMessage(msg.chat.id, 'Токен введен', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'На главную',
                                    callback_data: 'start'
                                }
                            ]
                        ]
                    }
                })
            } catch (error) {
                console.log(error);
                await bot.sendMessage(msg.chat.id, 'Данный токен не функционирует. Пожалуйста введите корректный токен.');
            }
        } else if (user && user?.answers?.find(el => el.waitingForResponse == true)) {
            await Bot.edit(msg, admins, bot, user, msg.text || '', answerRepo);
        }
    });

    bot.on('callback_query', async (q: TGBot.CallbackQuery) => {
        const user = await userRepo.findOneBy({chatId: String(q.from.id)});
        const admins = await adminRepo.find();
        if (user && q.data === 'enter-stats') {
            user.enteringStats = true;
            await userRepo.save(user);
            await bot.sendMessage(q.from.id, 'Отправьте мне токен статистики');
        } else if (user && q.data === 'no-promo') {
            user.registeredWithoutPromo = true;
            await userRepo.save(user);
            await bot.sendMessage(q.from.id, `Добро пожаловать в бот MPfact, ${user.name}\nВаш ID: ${user.chatId}\nДата регистрации: ${user.signupDate.toLocaleDateString()}\nТокен стандартный для отзывов:\n${user.enteredToken ? '✅Введен' : '❌Отсутствует'}\nТокен статистики для отчетов:\n${user.enteredStats ? '✅Введен' : '❌Отсутствует'}\n${user.supplierName ? `Имя поставщика: ${user.supplierName}` : ``}\n\nИнструкция по поиску и добавлению токенов здесь: https://telegra.ph/Instrukciya-po-dobavleniyu-tokenov-v-bot-MPfact-06-27`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Ввести стандартный токен (для отзывов):',
                                callback_data: 'enter-token'
                            }
                        ],
                        [
                            {
                                text: 'Ввести токен статистики (для отчетов):',
                                callback_data: 'enter-stats'
                            }
                        ]
                    ]
                },
                disable_web_page_preview: true
            });
        } else if (user && q.data === 'enter-token') {
            user.enteringToken = true;
            await userRepo.save(user);
            await bot.sendMessage(q.from.id, 'Отправьте мне стандартный токен (для отзывов)');
        } else if (user && q.data === 'start') {
            let keyboard: TGBot.InlineKeyboardButton[][] = [];
            if (user.enteredStats) {
                keyboard.push([{
                    text: 'Получить отчет',
                    callback_data: 'report'
                }]);
            } else {
                keyboard.push([{
                    text: 'Ввести токен статистики (для отчетов):',
                    callback_data: 'enter-stats'
                }]);
            }
            if (user.enteredToken) {
                keyboard.push([{
                    text: 'Ответить на отзывы',
                    callback_data: 'answer'
                }]);
            } else {
                keyboard.push([{
                    text: 'Ввести стандартный токен (для отзывов):',
                    callback_data: 'enter-token'
                }]);
            }
            await bot.sendMessage(q.from.id, `Добро пожаловать в бот MPfact, ${user.name}\nВаш ID: ${user.chatId}\nДата регистрации: ${user.signupDate.toLocaleDateString()}\nТокен стандартный для отзывов:\n${user.enteredToken ? '✅Введен' : '❌Отсутствует'}\nТокен статистики для отчетов:\n${user.enteredStats ? '✅Введен' : '❌Отсутствует'}\n${user.supplierName ? `Имя поставщика: ${user.supplierName}` : ``}\n\nИнструкция по поиску и добавлению токенов здесь: https://telegra.ph/Instrukciya-po-dobavleniyu-tokenov-v-bot-MPfact-06-27`, {
                reply_markup: {
                    inline_keyboard: keyboard
                },
                disable_web_page_preview: true
            });
        } else if (q.data === 'report') {
            await bot.sendChatAction(q.from.id, 'typing');
            const now = dayjs(new Date()).tz('Europe/Moscow');
            const today: string = dayjs(now).format('YYYY-MM-DD');
            if (!user) return await bot.sendMessage(q.from.id, 'Вы не авторизованы');
            if (!user.enteredStats) return await bot.sendMessage(q.from.id, 'Вы не ввели токен статистики');
            if (now.day() === 1 && now.hour() > 3 && now.hour() < 16) return await bot.sendMessage(q.from.id, 'У вайлдберриз перерыв в работе метода (каждый понедельник 3:00-16:00 МСК). Попробуйте позже.')
            try {
                const res: AxiosResponse<ISale[]> = await axios.get('https://statistics-api.wildberries.ru/api/v1/supplier/sales', {
                    headers: {
                        Authorization: user.statsToken
                    },
                    params: {
                        dateFrom: today,
                        flag: 1
                    }
                });
                const res2: AxiosResponse<IOrder[]> = await axios.get('https://statistics-api.wildberries.ru/api/v1/supplier/orders', {
                    headers: {
                        Authorization: user.statsToken
                    },
                    params: {
                        flag: 1,
                        dateFrom: today
                    }
                });
                let cancellations: IOrder[] = [];

                let refunds: ISale[] = [];
                res.data.forEach(el => {
                    if (el.saleID.startsWith('R')) refunds.push(el);
                });
                res2.data.forEach(el => {
                    // @ts-ignore
                    if (el.isCancel) cancellations.push(el);
                });

                await bot.sendMessage(q.from.id, `ОТЧЕТ ЗА СЕГОДНЯ (действительно на ${now.format('DD.MM.YYYY HH:mm')} МСК)\n\n` + TEXT_REPORT(res.data, res2.data, cancellations, refunds));

                admins.forEach(async (admin) => {
                    await bot.sendMessage(+admin.chatId, `Отчет получен пользователем ${q.from?.username || q.from?.first_name}, Промокод: ${user.special ? 'special23': 'ранняяпташка'}`);
                });
            } catch (error) {
                console.log(error);
                await bot.sendMessage(q.from.id, 'Произошла ошибка. Попробуйте через минуту.');
            }
        } else if (user && q.data === 'answer') {
            skipped = skipped.filter(el => {
                return el.userId !== user.id;
            });
            if (!user.enteredToken) return await bot.sendMessage(q.from.id, 'Вы не ввели стандартный токен. Это можно сделать в настройках')
            await Bot.home(q, bot, user);
        }
         else if (user && /reply-(.+)/.test(q.data || '')) {
            await bot.sendChatAction(q.from.id, 'typing');
            if (!user.enteredToken) return await bot.sendMessage(q.from.id, 'Вы не ввели стандартный токен. Это можно сделать в настройках')
            const match: RegExpExecArray|null = /reply-(.+)/.exec(q.data || '');
            if (!match) return;
            await Bot.reply(bot, answerRepo, skipped, user, openai, q, +match[1]);
        } else if (/publish-(.+)/.test(q.data || '')) {
            const match = /publish-(.+)/.exec(q.data || '');
            if (!match) return;
            await Bot.publish(q, bot, +match[1], answerRepo);
        } else if (user && /confirm-(.+)/.test(q.data || '')) {
            const match = /confirm-(.+)/.exec(q.data || '');
            if (!match) return;
            await Bot.confirm(user, +match[1], admins, bot, q, answerRepo);
        } else if (user && /reject-(.+)/.test(q.data || '')) {
            const match = /reject-(.+)/.exec(q.data || '');
            if (!match) return;
            await Bot.remove(q, +match[1], user, bot, answerRepo, skipped);
        } else if (user && /delete-(.+)/.test(q.data || '')) {
            const match = /delete-(.+)/.exec(q.data || '');
            if (!match) return;
            const admin = await adminRepo.findOneBy({chatId: String(q.from.id)});
            if (!admin) return await bot.sendMessage(q.from.id, 'Вы не админ');
            const user = await userRepo.findOneBy({id: +match[1]});
            if (!user) return
            await AppDataSource.query('SET session_replication_role = \'replica\';');
            await userRepo.remove(user);
            await AppDataSource.query('SET session_replication_role = \'origin\';');
            await bot.sendMessage(Number(admin.chatId), 'Пользователь удален');
        } else if ( user && /edit-(.+)/.test(q.data || '')) {
            const match = /edit-(.+)/.exec(q.data || '');
            if (!match) return;
            const answer = await answerRepo.findOneBy({id: +match[1]});
            if (!answer) return;
            answer.waitingForResponse = true;
            await answerRepo.save(answer);
            await bot.sendMessage(q.from.id, 'просто отправьте мне текст ответа.');
        } 
    });

    bot.onText(/^\/usersdetails$/, async (msg: TGBot.Message) => {
        const admin = await adminRepo.findOneBy({
            chatId: String(msg.chat.id),
        });
        if (!admin) return await bot.sendMessage(msg.chat.id, 'Вы не админ');
        const users = await userRepo.find();
        users.forEach(async user => {
            await bot.sendMessage(msg.chat.id, `
                Имя: ${user.name},
                @${user.tgName}
                Промокод: ${user.special ? 'special23' : 'ранняяпташка'}
            `, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Удалить',
                                callback_data: `delete-${user.id}`
                            }
                        ]
                    ]
                }
            })
        });
    });

    bot.onText(/^\/users$/, async (msg: TGBot.Message) => {
        try {
            const [result, count] = await userRepo.findAndCount();
            
            await bot.sendMessage(msg.chat.id, `Количество пользователей всего: ${count}\nС промокодом ранняяпташка: ${result.filter(e => e.enteredPromo && !e.special).length}\nС промокодом special23: ${result.filter(e => e.enteredPromo && e.special).length}\nБез промокода: ${result.filter(e => !e.enteredPromo).length}\nЗарегистрировались сегодня: ${result.filter(e => e.signupDate.getDay() === (new Date()).getDay() && e.signupDate.getMonth() === (new Date()).getMonth() && e.signupDate.getFullYear() === (new Date()).getFullYear()).length}`);
            
        } catch (error) {
            console.log(error);
        }
    });

    bot.onText(/\/admin (.+)/, async (msg: TGBot.Message, match: RegExpExecArray | null) => {
        if (match && match[1] !== 'пташкаадминистратор') return await bot.sendMessage(msg.chat.id, 'Неверный промокод админа');
        let admin = new Admin();
	admin.chatId = String(msg.chat.id)
        const result = await adminRepo.save(admin);
        if (!result) return await bot.sendMessage(msg.chat.id, 'Произошла ошибка');
        await bot.sendMessage(msg.chat.id, 'Пользователь добавлен как администратор, просмотреть пользователей: /users');
        // TODO: сделать через крон
        setTimeout(async () =>{
            setInterval(async () => {
                const [result, count] = await userRepo.findAndCount();
                await bot.sendMessage(msg.chat.id, `Количество пользователей всего: ${count}\nС промокодом ранняяпташка: ${result.filter(e => e.enteredPromo && !e.special).length}\nС промокодом special23: ${result.filter(e => e.enteredPromo && e.special).length}\nБез промокода: ${result.filter(e => !e.enteredPromo).length}`);
            }, 24*60*60*1000);
        }, (new Date()).getHours() >= 21 ? 0 : (21 - (new Date()).getHours()) * 60 * 60 * 1000);
    });

    bot.onText(/\/report/, async (msg: TGBot.Message) => {
        const now = dayjs(new Date()).tz('Europe/Moscow');
        const today: string = dayjs(now).format('YYYY-MM-DD');
        const user: User = await userRepo.findOneBy({chatId: String(msg.chat.id)});
        const admins: Admin[] = await adminRepo.find();
        await bot.sendChatAction(msg.chat.id, 'typing');
        if (!user) return await bot.sendMessage(msg.chat.id, 'Вы не авторизованы');
        if (!user.enteredStats) return await bot.sendMessage(msg.chat.id, 'Вы не ввели токен статистики');
        try {
            const res: AxiosResponse<ISale[]> = await axios.get('https://statistics-api.wildberries.ru/api/v1/supplier/sales', {
                headers: {
                    Authorization: user.statsToken
                },
                params: {
                    dateFrom: today,
                    flag: 1
                }
            });
            const res2: AxiosResponse<IOrder[]> = await axios.get('https://statistics-api.wildberries.ru/api/v1/supplier/orders', {
                headers: {
                    Authorization: user.statsToken
                },
                params: {
                    flag: 1,
                    dateFrom: today
                }
            });
            let cancellations: IOrder[] = [];

            let refunds: ISale[] = [];
            res.data.forEach(el => {
                if (el.saleID.startsWith('R')) refunds.push(el);
            });
            res2.data.forEach(el => {
                // @ts-ignore
                if (el.isCancel) cancellations.push(el);
            });

            await bot.sendMessage(msg.from.id, `ОТЧЕТ ЗА СЕГОДНЯ (действительно на ${now.format('DD.MM.YYYY HH:mm')} МСК)\n\n` + TEXT_REPORT(res.data, res2.data, cancellations, refunds));

            admins.forEach(async (admin) => {
                await bot.sendMessage(+admin.chatId, `Отчет получен пользователем ${msg.from?.username || msg.from?.first_name}, Промокод: ${user.special ? 'special23': 'ранняяпташка'}`);
            });
        } catch (error) {
            console.log(error);
            await bot.sendMessage(msg.chat.id, 'Произошла ошибка. Попробуйте через минуту.');
        }
    });

    bot.onText(/\/month_report/, async (msg: TGBot.Message) => {
        const user = await userRepo.findOneBy({chatId: String(msg.chat.id)});
        const admins = await adminRepo.find();
        await bot.sendChatAction(msg.chat.id, 'typing');
        if (!user) return await bot.sendMessage(msg.chat.id, 'Вы не авторизованы');
        if (!user.enteredStats) return await bot.sendMessage(msg.chat.id, 'Вы не ввели токен статистики');

        const now = dayjs(new Date()).tz('Europe/Moscow');
        const today = now.format('YYYY-MM-DD');
        const yesterday = now.subtract(1, 'day').format('YYYY-MM-DD');
        const week = now.subtract(7, 'day').format('YYYY-MM-DD');
        const month = now.subtract(30, 'day').format('YYYY-MM-DD');

        const periodData: Record<string, { title: string, orders: IOrder[], cancels: IOrder[], sales: ISale[], refunds: ISale[] }> = {
            today: {
                title: 'СЕГОДНЯ',
                orders: [],
                cancels: [],
                sales: [],
                refunds: []
            },
            yesterday: {
                title: 'ВЧЕРА',
                orders: [],
                cancels: [],
                sales: [],
                refunds: []
            },
            week: {
                title: 'ЗА 7 ДНЕЙ',
                orders: [],
                cancels: [],
                sales: [],
                refunds: []
            },
            month: {
                title: 'ЗА 30 ДНЕЙ',
                orders: [],
                cancels: [],
                sales: [],
                refunds: []
            },
        }

        try {
            const res: AxiosResponse<ISale[]> = await axios.get('https://statistics-api.wildberries.ru/api/v1/supplier/sales', {
                headers: {
                    Authorization: user.statsToken
                },
                params: {
                    flag: 0,
                    dateFrom: month,
                }
            });
            const res2: AxiosResponse<IOrder[]> = await axios.get('https://statistics-api.wildberries.ru/api/v1/supplier/orders', {
                headers: {
                    'Authorization': user.statsToken
                },
                params: {
                    flag: 0,
                    dateFrom: month,
                }
            });

            res.data.forEach(sale => {
                // @ts-ignore
                const lastChangeDate: string = dayjs(sale.lastChangeDate).format('YYYY-MM-DD');
                // @ts-ignore
                const date: string = dayjs(sale.date).format('YYYY-MM-DD')

                if (date === today) periodData.today.sales.push(sale);
                if (lastChangeDate === today && sale.saleID.startsWith('R')) periodData.today.refunds.push(sale);

                if (date === yesterday) periodData.yesterday.sales.push(sale);
                if (lastChangeDate === yesterday && sale.saleID.startsWith('R')) periodData.yesterday.refunds.push(sale);

                if (date >= week) periodData.week.sales.push(sale);
                if (lastChangeDate >= week && sale.saleID.startsWith('R')) periodData.week.refunds.push(sale);

                if (date >= month) periodData.month.sales.push(sale);
                if (lastChangeDate >= month && sale.saleID.startsWith('R')) periodData.month.refunds.push(sale);
            });

            res2.data.forEach(order => {
                // @ts-ignore
                const date: string = dayjs(order.date).format('YYYY-MM-DD');
                // @ts-ignore
                const cancelDate: string = dayjs(order.cancel_dt).format('YYYY-MM-DD');

                if (date === today) periodData.today.orders.push(order);
                if (order.isCancel && cancelDate === today) periodData.today.cancels.push(order)

                if (date === yesterday) periodData.yesterday.orders.push(order);
                if (order.isCancel && cancelDate === yesterday) periodData.yesterday.cancels.push(order);

                if (date >= week) periodData.week.orders.push(order);
                if (order.isCancel && cancelDate >= week) periodData.week.cancels.push(order);

                if (date >= month) periodData.month.orders.push(order);
                if (order.isCancel && cancelDate >= month) periodData.month.cancels.push(order);
            });

            let periodReports: string[] = [];

            for (const period in periodData) {
                const prd = periodData[period];
                periodReports.push(`<b>${prd.title}</b>\n` + TEXT_REPORT(prd.sales, prd.orders, prd.cancels, prd.refunds));
            }

            await bot.sendMessage(msg.from.id, `ОТЧЕТ ЗА 30 ДНЕЙ (действительно на ${now.format('DD.MM.YYYY HH:mm')} МСК)\n\n${periodReports.join('\n\n')}`, {
                parse_mode: 'HTML'
            });

            admins.forEach(async (admin) => {
                await bot.sendMessage(+admin.chatId, `Отчет получен пользователем ${msg.from?.username || msg.from?.first_name}, Промокод: ${user.special ? 'special23': 'ранняяпташка'}`);
            });
        } catch (error) {
            console.log(error);
            await bot.sendMessage(msg.chat.id, 'Произошла ошибка. Попробуйте через минуту.');
        }
    });

    bot.onText(/\/answer/, async (msg: TGBot.Message) => {
        const user = await userRepo.findOneBy({chatId: String(msg.chat.id)});
        if (!user) return await bot.sendMessage(msg.from?.id || 0, 'Вы не авторизованы');
        await Bot.newHome(msg, bot, user);
    });
}).catch(error => console.log(error))
