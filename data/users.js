import fs from 'node:fs'

const PATH = 'users.json'

const users = JSON.parse(fs.readFileSync(PATH))

const getUser = async (ctx) => {
    const { id, username, first_name } = ctx.from
    
    console.log(ctx.from)
    
    if(!users[id]) {
        users[id] = {
            id,
            name: first_name,
            tag: username,
            groups: [],
        };
        save()
    }
    
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
    save,
    reset
}
