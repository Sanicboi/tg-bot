import { User } from "../entity/User";
import { DataSource, Repository } from "typeorm";

export class UserController {
    private repo: Repository<User>;
    private dataSource: DataSource;


    constructor(source: DataSource) {
        this.dataSource = source;
        this.repo = this.dataSource.getRepository(User);
    }


    public async one(chatId: string): Promise<User|boolean> {
        try {
            const user = await this.repo.findOne({
                where: {
                    chatId: chatId
                }
            });
            return user ? user : false;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    
}