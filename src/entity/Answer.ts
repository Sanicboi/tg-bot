import {Column, PrimaryGeneratedColumn, Entity, ManyToOne, Repository} from 'typeorm';
import { User } from './User';
import { OpenAIApi } from 'openai';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { WBRes } from '..';

@Entity()
export class Answer {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    text: string

    @Column()
    fbId: string

    @Column({
        nullable: true
   })
    count: number

    @Column({
        nullable: true
   })
    waitingForResponse: boolean

    @Column({
        nullable: true
   })
    valuation: number

//     @Column({
//         nullable: true
//    })
//     waitingForConfirmation: boolean

   @Column({
    
   })

   @Column()
   createdAt: Date;

   @Column({
    default: false,
   })
   edited: boolean;

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
                    take: 5000,
                    skip: 0,
                    order: "dateDesc"
                }
            });
            const filtered = previous.data.data.feedbacks.filter(e => e.productDetails.nmId === nmId).filter((e, idx) => idx < 4).map(e => {
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
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `Ты - продавец на маркетплейсе. Тебе пришлют отзыв в формате JSON. Твоя задача - коротко на него ответить на основе предыдущих ответов на отзывы. Обратись к покупателю по имени. Не используй текст "маркетплейс" или "наш маркетплейс". Не пиши в конце ответа текст типа: "Ждем вас в нашем магазине". Если примеров нет - ответь сам. Не упоминай в конце сообщения: "магазин". Примеры отзывов и ответов на них в формате JSON:\n ${JSON.stringify({ feedbacks: filtered})}`
                    },
                    {
                        role: 'user',
                        content: feedback
                    }
                ],
            }, {
		headers: {
			'Authorization': `Bearer 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`
		}
	})
            answer.text = res.data.choices[0].message.content;
            answer.fbId = fbId;
            answer.valuation = valuation;
            answer.user = user;
            const result = await repo.save(answer);
            return result;
        } catch (error) {
            console.log(error.response?.data);
            console.log(error);
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
            return answer;

        } catch (error) {
            console.log(error);
            return false;
        }
    }
    public static async destroy(id: number, repo: Repository<Answer>): Promise<false | Answer> {
        try {
            const answer = await repo.findOneBy({id: id});
            return answer;
        } catch (error) {
            console.log(error);
            return false;
        }
    } 
    public static async confirm(id: number, user: User, repo: Repository<Answer>): Promise<false | Answer> {
        try {
            const answer = await repo.findOneBy({
                id
            });
		console.log(answer);
            await axios.patch('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                    id: answer.fbId,
                    text: answer.text
            }, {
		headers: {
			'Authorization': user.token
		}
	});
            return answer;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    public static async recreate(fbId: string,feedback: string, nmId: number, valuation: number, user: User, repo: Repository<Answer>, openai: OpenAIApi): Promise<false | Answer> {
        try {
            const previous: AxiosResponse<WBRes> = await axios.get('https://feedbacks-api.wb.ru/api/v1/feedbacks', {
                headers: {
                    Authorization: user.token
                },
                params: {
                    isAnswered: true,
                    take: 5000,
                    skip: 0,
                    order: "dateDesc"
                }
            });
            const filtered = previous.data.data.feedbacks.filter(e => e.productDetails.nmId === nmId).filter((e, idx) => idx < 4).map(e => {
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
                        content: `Ты - продавец на маркетплейсе. Тебе пришлют отзыв в формате JSON. Твоя задача - коротко на него ответить на основе предыдущих ответов на отзывы. Обратись к покупателю по имени. Не используй текст "маркетплейс" или "наш маркетплейс". Не пиши в конце ответа текст типа: "Ждем вас в нашем магазине". Если примеров нет - ответь сам. Не упоминай в конце сообщения: "магазин". Примеры отзывов и ответов на них в формате JSON:\n ${JSON.stringify({ feedbacks: filtered})}`
                    },
                    {
                        role: 'user',
                        content: feedback
                    }
                ],
                temperature: 0
            }, {
		headers: {
			'Authorization': `Bearer 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`
		}
	});
            answer.text = res.data.choices[0].message.content;
            answer.fbId = fbId;
            answer.valuation = valuation;
            answer.user = user;
            const result = await repo.save(answer);
            return result;
        } catch (error) {
            console.log(error.response?.data);
            console.log(error);
            return false;
        }
    }
}

