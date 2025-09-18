import fs from 'node:fs'

const PATH = 'chats.json'

const chats = JSON.parse(fs.readFileSync(PATH))

const getChat = async (ctx) => {
    const { id, title, type } = ctx.chat
    
    if(!chats[id]) {
        chats[id] = {
            id,
            title,
            type,
            messages: [],
            members: [],
        };
        save()
    }
    
    return chats[id];
}

const getChatById = async id => {
    return chats[id];
}

const save = async () => {
    fs.writeFileSync(PATH, JSON.stringify(chats, null, 2))
}

const reset = () => {
    for (const key in chats) delete chats[key];
}

export {
    getChat,
    getChatById,
    save,
    reset
}
