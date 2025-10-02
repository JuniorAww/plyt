import Module from '../module.js'
import { chats } from '../utils/data.js'
import { bot } from '../index.js'

class AITalkingModule extends Module {
    description = "Свой ии-тренер Duolingo"
    priority = 75
    
    async onMessage(ctx, next) {
        if (ctx.chat.id > 0) {
            const chat = await ctx.getInfo();
            
            if (ctx.text === '/words') return await handleTrainerCommand(ctx, chat)
        }
        
        next()
    }
}

const handleTrainerCommand = async (ctx) => {
    const user = await ctx.getUser();
    
    if (!user.lang) user.lang = {};
    
    
}

let generating = false;

const getResponse = async (ctx, entry) => {
    generating = true;
    
    const prompt = "";
    
    const resp = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: 
            JSON.stringify({
                model: "gemma3:12b",
                prompt,
                num_predict: 64,
                stream: false,
            })
    });
    
    let full = "";
    for await (const chunk of resp.body) {
        const text = Buffer.from(chunk).toString("utf-8");
        full += text;
    }
    
    let response;
    try {
        response = JSON.parse(full)
    } catch (e) {
        console.log(e);
        return null;
    }
    
    console.log("Ответ модели:", response);
    generating = null;
    return response.response;
}

export default AITalkingModule
