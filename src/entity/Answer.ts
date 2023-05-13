import {Column, PrimaryGeneratedColumn, Entity, ManyToOne} from 'typeorm';
import { User } from './User';

@Entity()
export class Answer {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
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