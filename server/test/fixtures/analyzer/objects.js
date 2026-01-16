const point = {
    x: 10,
    y: 20,
    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    },
};

let px = point.x;
point.move(5, 5);
let newPx = point.x;

class Person {
    constructor(name) {
        this.name = name;
    }
    sayHello() {
        return 'Hi, I am ' + this.name;
    }
}

const me = new Person('Marios');
let myName = me.name;
let msg = me.sayHello();
