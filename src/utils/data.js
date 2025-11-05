import fs from 'node:fs'

class Data {
    constructor(path) {
        this.path = path;
        if (!fs.existsSync(path)) this.data = {}
        else this.data = JSON.parse(fs.readFileSync(path));
    }
    
    async save() {
        fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2))
    }
}

class Users extends Data {
    async getUser(ctx) {
        const { id, username, first_name } = ctx.from
        
        if (!this.data[id]) {
            this.data[id] = {
                id,
                name: first_name,
                tag: username,
                groups: {},
                level: [0, 50, 0]
            };
            save()
        }
        
        const CHAT = ctx.chat.id;
        if (CHAT < 0 && !this.data[id].groups[CHAT]) 
            this.data[id].groups[CHAT] = true;
        
        const user = this.data[id];
        return this.data[id];
    }
    
    async getUserById(id) {
        return this.data[id];
    }
    
    async get() {
        return JSON.parse(JSON.stringify(this.data))
    }
}

class Chats extends Data {
    async getChat(ctx) {
        const { id, title, type } = ctx.chat
        
        if(!this.data[id]) {
            this.data[id] = {
                id,
                title,
                type,
                messages: [],
                members: [],
            };
            save()
        }
        
        return this.data[id];
    }
    
    async getChatById(id) {
        return this.data[id];
    }
    
    async get() {
        return JSON.parse(JSON.stringify(this.data))
    }
}

const chats = new Chats("data/chats.json")
const users = new Users("data/users.json")

setInterval(async () => {
    await chats.save();
    await users.save();
    console.log('Сохранено')
}, 1000 * 30)

export { users, chats };
export const save = async () => { await users.save(); await chats.save() };


