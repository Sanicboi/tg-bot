import { AppDataSource } from "./data-source"
import { User } from "./entity/User"
import { Answer } from "./entity/Answer";
import TGBot from "node-telegram-bot-api"
import axios, { AxiosResponse } from "axios";
import {Configuration, OpenAIApi} from "openai"
import { Admin } from "./entity/Admin";
const bot = new TGBot(process.env.TG_KEY || '', {polling: true});
let signingUp: number[] = [];
export interface Ifeedback {id: string, text: string, productValuation: number, productDetails:{productName: string, nmId: number, supplierName: string}};
export interface WBRes {data: {feedbacks: Ifeedback[]}}
export interface Iskipped {
    fbId: string,
    userId: number
}
import { Bot } from "./funcs/bot";

let skipped: Iskipped[] = [];
const conf = new Configuration({apiKey: process.env.OPENAI_KEY || ''});
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

    bot.onText(/\/users/, async (msg: TGBot.Message) => {
        const users = await userRepo.find();
        users.forEach(async user => {
            await bot.sendMessage(msg.chat.id, `
                Имя: ${user.name},
                Телефон: ${user.phone}
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
    })

    bot.onText(/\/admin (.+)/, async (msg: TGBot.Message, match: RegExpExecArray) => {
        if (match[1] !== 'пташкаадминистратор') return await bot.sendMessage(msg.chat.id, 'Неверный промокод админа');
        let admin = new Admin();
        admin.chatId = msg.from?.id;
        const result = await adminRepo.save(admin);
        if (!result) return await bot.sendMessage(msg.chat.id, 'Произошла ошибка');
        await bot.sendMessage(msg.chat.id, 'Пользователь добавлен как администратор, просмотреть пользователей: /users');
    });

    bot.onText(/\/token (.+)/, async (msg: TGBot.Message, match: RegExpExecArray) => {
        const user = await userRepo.findOneBy({chatId: msg.chat.id});
        if (!user) return await bot.sendMessage(msg.from.id, 'Вы не авторизованы');
        user.token = match[1];
        await userRepo.save(user);
        await bot.sendMessage(msg.from.id, 'Токен изменён', {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'ответить',
                            callback_data: 'answer'
                        }
                    ]
                ]
            }
        });
    })

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
                const res: AxiosResponse<WBRes> = await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                    headers: {
                        Authorization: match[1]
                    },
                    params: {
                        take: 10000,
                        skip: 0,
                        isAnswered: false,
                        order: "dateDesc"
                    }
                });
                if (res.status !== 200) throw new Error('No connection with api');
                await bot.sendMessage(msg.chat.id, `
                Количество необработанных отзывов: ${res.data.data.feedbacks.length}
                Из них: 
                5 звезд: ${res.data.data.feedbacks.filter(el => el.productValuation === 5).length}
                4 звезды: ${res.data.data.feedbacks.filter(el => el.productValuation === 4).length}
                3 звезды: ${res.data.data.feedbacks.filter(el => el.productValuation === 3).length}
                2 звезды: ${res.data.data.feedbacks.filter(el => el.productValuation === 2).length}
                1 звезда: ${res.data.data.feedbacks.filter(el => el.productValuation === 1).length}
                `);
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
            await Bot.newHome(msg, bot, user);
        } else if (user?.answers.find(el => el.waitingForResponse === true)) {
            await Bot.edit(msg, admins, bot, user, msg.text, answerRepo);
        } 
    });

    bot.on('callback_query',async  (q: TGBot.CallbackQuery) => {
        const user = await userRepo.findOne({
            where: {
                chatId: q.from.id
            }
        });
        if (q.data === 'answer') {
            skipped = skipped.filter(el => {
                return el.userId !== user.id;
            });
            await Bot.home(q, bot, user);
        } else if (/reply-(.+)/.test(q.data)) {
            const match = /reply-(.+)/.exec(q.data);
            await Bot.reply(bot, answerRepo, skipped, user, openai, q, +match[1]);
        } else if (/publish-(.+)/.test(q.data)) {
            const match = /publish-(.+)/.exec(q.data);
            await Bot.publish(q, bot, +match[1], answerRepo);
        } else if (/confirm-(.+)/.test(q.data)) {
            const match = /confirm-(.+)/.exec(q.data);
            await Bot.confirm(user, +match[1], admins, bot, q, answerRepo);
        } else if (/reject-(.+)/.test(q.data)) {
            const match = /reject-(.+)/.exec(q.data);
            await Bot.remove(q, +match[1], user, bot, answerRepo, skipped);
        } else if (/delete-(.+)/.test(q.data)) {
            const match = /delete-(.+)/.exec(q.data);
            const admin = await adminRepo.findOneBy({chatId: q.from.id});
            if (!admin) return await bot.sendMessage(q.from.id, 'Вы не админ');
            const user = await userRepo.findOneBy({id: +match[1]});
            if (!user) return
            await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 0');
            await userRepo.query(`DELETE FROM user WHERE id = ${user.id}`);
            await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 1');
            await bot.sendMessage(admin.chatId, 'Пользователь удален');
        } else if (/edit-(.+)/.test(q.data)) {
            const match = /edit-(.+)/.exec(q.data);
            const answer = await answerRepo.findOneBy({id: +match[1]});
            answer.waitingForResponse = true;
            await answerRepo.save(answer);
            await bot.sendMessage(q.from.id, 'просто отправьте мне текст ответа.');
        }
    });
}).catch(error => console.log(error))
