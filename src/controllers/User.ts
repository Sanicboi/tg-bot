import { User } from "../entity/User";
import { DataSource, Repository } from "typeorm";

export class UserController {
    private repo: Repository<User>;
    private dataSource: DataSource;


    constructor(source: DataSource) {
        this.dataSource = source;
        this.repo = this.dataSource.getRepository(User);
    }


    public async one(chatId: string): Promise<User|false> {
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

    public async create(chatId: string, name: string, tgName: string): Promise<boolean> {
        const user = new User();
        user.chatId = chatId;
        user.name = name;
        user.enteredPromo = false;
        user.enteredStats = false;
        user.enteringStats = false;
        user.enteredToken = false;
        user.enteringToken = false;
        user.registeredWithoutPromo = false;
        user.signupDate = new Date();
        user.name = name;
        user.special = false;
        user.tgName = tgName;
        try {
            await this.repo.save(user);
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    public async startEnteringToken(chatId: string, type: "basic" | "stats"): Promise<boolean> {
        const user = await this.one(chatId);
        if (!user) return false;
        
        if (type === "basic") {
            user.enteringToken = true;
        } else {
            user.enteredStats = true;
        }

        try {
            await this.repo.save(user);
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    public async stopEnteringTokens(chatId: string): Promise<boolean> {
        const user = await this.one(chatId);
        if (!user) return false;

        user.enteringToken = false;
        user.enteredStats = false;

        try {
            await this.repo.save(user);
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    public async enterPromo(chatId: string, type: "basic" | "special" | "nopromo"): Promise<boolean> {
        const user = await this.one(chatId);
        if (!user) return false;

        if (type === "basic") {
            user.enteredPromo = true;
        } else if (type === "special") {
            user.enteredPromo = true;
            user.special = true;
        } else {
            user.registeredWithoutPromo = true;
        }

        try {
            await this.repo.save(user);
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }
}