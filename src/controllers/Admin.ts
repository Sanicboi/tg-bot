import { Repository, DataSource } from "typeorm";
import { Admin } from "../entity/Admin";

export class AdminController {
    public readonly repo: Repository<Admin>
    private dataSource: DataSource;

    constructor(source: DataSource) {
        this.dataSource = source;
        this.repo = this.dataSource.getRepository(Admin);
    }

    public async one(chatId: string): Promise<Admin|false> {
        try {
            const admin = await this.repo.findOne({
                where: {
                    chatId: chatId,
                }
            });
            if (!admin) return false;
            return admin;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    public async create(chatId: string): Promise<{ok: boolean, exists: boolean}> {
        const admin = new Admin();
        const found = await this.one(chatId);
        if (found) return {ok: false, exists: true};
        admin.chatId = chatId;

        try {
            await this.repo.save(admin);
            return {ok: true, exists: false};
        } catch (error) {
            console.log(error);
            return {ok: false, exists: false};
        }
    }

    public async all(): Promise<Admin[] | false> {
        try {
            const admins = await this.repo.find();
            if (!admins) return false;
            return admins;
        } catch (error) {
            console.log(error);
            return false;
        }
    }
}