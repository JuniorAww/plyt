import Module from '../module.js'
import { bot } from '../index.js'
import fs from 'node:fs'
import path from 'node:path'

class LoggerModule extends Module {
    description = "Логирование"
    priority = 0
    
    async onEverything(ctx, next) {
        try {
            handleLog(JSON.stringify(ctx.update))
        } catch (e) { console.error('Couldn\'t log:', e) }
        next();
    }
}

const PERIOD = 1000 * 60 * 30
const FOLDER = "./logs/"
let latestLogFile
let currentLogFile
let stream;

const init = () => {
    if (!fs.existsSync('./logs')) fs.mkdirSync('./logs')
    
    const now = Date.now()
    
    setTimeout(() => {
        setInterval(newLogFile(), PERIOD)
        newLogFile();
    }, PERIOD - (now % PERIOD))
    
    newLogFile();
}

/* TODO */
/* worker_threads для логов */
const handleLog = async (update) => {
    if (!stream || latestLogFile !== currentLogFile) {
        latestLogFile = currentLogFile;
        if (stream) stream.destroy();
        stream = fs.createWriteStream(currentLogFile, { flags: "a" });
    }
    
    const date = new Date()
    const time = date.getMinutes() + ':' + date.getSeconds() + '-' + (Date.now() % 1000);
    const line = `[${time}] ${escape(update)}\n`;
    
    stream.write(line);
}

function escape(str) {
    return str.replace(/\r?\n|\r/g, "\\n");
}

const newLogFile = () => {
    const date = new Date()
    
    currentLogFile = FOLDER + date.getFullYear() + '-' + 
                     (date.getMonth() + 1) + '-' + 
                     date.getDate() + ' ' +
                     date.getHours() + '-' +
                     Math.ceil(date.getMinutes() / 30) + '.txt';
    
    console.log('Открыт новый лог: ', currentLogFile);
}

init()

export default LoggerModule
