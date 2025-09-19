import fs from 'node:fs'

const PATH = 'users.json'

const users = JSON.parse(fs.readFileSync(PATH))

/**
 Формат записи user.groups:
 [ is_admin, messages, stickers, audio_messages, video_messages, photo, video ]
 Формат level:
 [ level, exp_left, exp_total ]
 */

const getUser = async (ctx) => {
    const { id, username, first_name } = ctx.from
    
    if (!users[id]) {
        users[id] = {
            id,
            name: first_name,
            tag: username,
            groups: {},
            level: [0, 50, 0]
        };
        save()
    }
    
    const user = users[id];
    
    if (ctx.chat.id < 0) {
        //const chid = ctx.chat.id
        //if (!user.groups[chid]) user.groups[chid] = [0, 0, 0, 0, 0]
    }
    
    return users[id];
}

const getUserById = async id => {
    return users[id];
}

const save = async () => {
    console.log('saving users to', PATH)
    fs.writeFileSync(PATH, JSON.stringify(users, null, 2))
}

const reset = () => {
    for (const key in users) delete users[key];
}


export {
    getUser,
    getUserById,
    save,
    reset
}
