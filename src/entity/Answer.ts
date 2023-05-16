import {Column, PrimaryGeneratedColumn, Entity, ManyToOne, Repository} from 'typeorm';
import { User } from './User';
import { OpenAIApi } from 'openai';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { WBRes } from '..';

@Entity()
export class Answer {
    @PrimaryGeneratedColumn()
    id: number

    @Column({
        charset: 'koi8r'
    })
    text: string

    @Column()
    fbId: string

    @Column()
    count: number

    @Column()
    waitingForResponse: boolean

    @Column()
    valuation: number

    @Column()
    waitingForConfirmation: boolean

    @ManyToOne(() => User, (user) => user.answers)
    user: User
}

export class AnswerWrapper {
    public static async create(fbId: string,feedback: string, nmId: number, valuation: number, user: User, repo: Repository<Answer>, openai: OpenAIApi): Promise<false | Answer> {
        try {
            const previous: AxiosResponse<WBRes> = await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                headers: {
                    Authorization: user.token
                },
                params: {
                    isAnswered: true,
                    take: 10000,
                    skip: 0,
                    order: "dateDesc"
                }
            });
            const filtered = previous.data.data.feedbacks.filter(e => e.productDetails.nmId === nmId).filter((e, idx) => idx < 9).map(e => {
                const {supplierName, ...rest} = e.productDetails;
                const {...rest2} = e;
                return {
                    productDetails: {
                        ...rest
                    },
                    ...rest2
                }
            });
            const answer = new Answer();
            const res = await openai.createChatCompletion({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `Ты - продавец на маркетплейсе. Тебе пришлют отзыв в формате JSON. Твоя задача - коротко на него ответить на основе предыдущих ответов на отзывы. Обратись к покупателю по имени. Не используй текст "маркетплейс" или "наш маркетплейс". Не пиши в конце ответа текст типа: "Ждем вас в нашем магазине". Если примеров нет - ответь сам. Не упоминай в конце сообщения: "магазин". Примеры отзывов ответов на них в формате JSON:\n ${JSON.stringify({ feedbacks: filtered})}`
                    },
                    {
                        role: 'user',
                        content: feedback
                    }
                ]
            });
            answer.text = res.data.choices[0].message.content;
            answer.fbId = fbId;
            answer.valuation = valuation;
            answer.user = user;
            const result = await repo.save(answer);
            return result;
        } catch (error) {
            console.log(error.response?.data);
            return false;
        }
    }
    public static async change(text: string, repo: Repository<Answer>): Promise<false | Answer> {
        try {
            const answer = await repo.findOne({
                where: {waitingForResponse: true}
            });
            answer.text = text;
            answer.waitingForResponse = false;
            await repo.save(answer);
            // if (process.env.NODE_ENV === 'PROD') {
            //     await axios.patch('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
            //         id: answer.fbId,
            //         text: text
            //     });
            // }
            return answer;

        } catch (error) {
            console.log(error);
            return false;
        }
    }
    public static async destroy(id: number, repo: Repository<Answer>): Promise<false | Answer> {
        try {
            const answer = await repo.findOneBy({id: id});
            if (!answer) return false;
            const result = await repo.delete(answer);
            if (!result.affected) return false;
            return answer;
        } catch (error) {
            console.log(error);
            return false;
        }
    } 
    public static async confirm(id: number, repo: Repository<Answer>): Promise<false | Answer> {
        try {
            const answer = await repo.findOneBy({
                id
            });
            if (process.env.NODE_ENV === 'PROD') {
                await axios.patch('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                    id: answer.fbId,
                    text: answer.text
                });
            }
            return answer;
        } catch (error) {
            console.log(error);
            return false;
        }
    }
}