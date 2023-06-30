import { Answer } from "../entity/Answer";
import { Repository, DataSource } from "typeorm";
import { User } from "../entity/User";


export class AnswerController {
    public readonly repo: Repository<Answer>;
    private dataSource: DataSource;

    constructor(source: DataSource) {
        this.dataSource = source;
        this.repo = source.getRepository(Answer);
    }

    public async create(user: User, text: string): Promise<Answer|false> {
        const answer = new Answer();
        answer.user = user;
        // answer.waitingForConfirmation = false;
        answer.createdAt = new Date();
        answer.waitingForResponse = false;
        answer.text = text;
        answer.count = 0;
        try {
            await this.repo.save(answer);
            return answer;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    public async one(id: number) {
        try {
            const answer = await this.repo.findOne({where: {
                id: id,
            }});
            if (!answer) return false;
            return answer;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    public async edit(id: number, newText: string, generated: boolean): Promise<boolean> {
        const answer = await this.one(id);
        if (!answer) return false;
        if (generated) answer.count++;
        if (!generated) answer.waitingForResponse = false;
        answer.text = newText;
        try {
            await this.repo.save(answer);
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    public async startEditing(id: number): Promise<boolean> {
        const answer = await this.one(id);
        if (!answer) return false;

        answer.waitingForResponse = true;

        try {
            await this.repo.save(answer);
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    public async destroy(id: number): Promise<boolean> {
        const answer = await this.one(id);
        if (!answer) return false;

        try {
            await this.repo.remove(answer);
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }
}