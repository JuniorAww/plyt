/* Шаблон (абстрактный класс) под модули */
export default class Module {
    getDescription() {
        return this.description;
    }
    
    getPriority() {
        return this.priority;
    }
    
    check() {
        if (this.priority === undefined || this.description === undefined) 
            return "no priority/description set";
        return false;
    }
    
    async onEverything() {}
    async onMessage() {}
    async onCallback() {}
    async onStart() {}
    async onPhoto() {}
    async onChatJoinRequest() {}
}
