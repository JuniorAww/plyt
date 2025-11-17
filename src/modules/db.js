import fs from 'node:fs'

let users = []
let chats = []
let saver = null
let debug = true

const _users = "./data/users.json"
const _chats = "./data/chats.json"


const load = () => {
    users = JSON.parse(fs.existsSync(_users) ? fs.readFileSync(_users) : '{}')
    chats = JSON.parse(fs.existsSync(_chats) ? fs.readFileSync(_chats) : '{}')
}

const autosave = sec => {
    saver = setInterval(() => {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data')
        fs.writeFileSync(_users, stringify(users))
        fs.writeFileSync(_chats, stringify(chats))
    }, sec * 1000)
}

const stringify = s => debug ? JSON.stringify(s, null, 2) : JSON.stringify(s)


/* async so the future migration to SQL will be faster */
const userMiddleware = async ctx => {
    if (ctx.from) {
        const { id, first_name: name } = ctx.from
        if (!users[id]) users[id] = {
            name
        }
        ctx.getUser = async () => {
           if (ctx._user) return ctx._user
           ctx._user = users[id]
           return ctx._user
        }
    }
    
    if (ctx.chat.id < 0) {
        const { id, title } = ctx.chat
        if (!chats[id]) chats[id] = {
            title
        }
        ctx.getChat = async () => {
           if (ctx._chat) return ctx._chat
           ctx._chat = chats[id]
           return ctx._chat
        }
        if (ctx.from) ctx.getBoth = 
            async () => [ await ctx.getUser(), await ctx.getChat() ]
    }
    
    ctx.findChat = id => findChat(id)
    ctx.findChats = id => findChats(id)
    ctx.findUser = id => findUser(id)
}


const findChat = async id => chats[id]
const findUser = async id => users[id]
const findChats = async func => {
    const result = []
    for (const id in chats) {
        if (await func(chats[id], id)) result.push({ id, ...chats[id] })
    }
    return result
}



load()
autosave(30)

export const getChats = () => chats

export default {
    priority: 1,
    init: bot => {
        bot.alwaysUse(userMiddleware)
        bot.states.save = (ctx, new_state) => {
            users[ctx.from.id].state = new_state
        }
        bot.states.load = ctx => {
            return users[ctx.from.id]?.state || {}
        }
    }
}
