const point = {
    x: 10,
    y: 20,
    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    },
};

let px = point.x;
//  ^hover
//       ^hover
//             ^hover
point.move(5, 5);
//    ^hover
//    ^def
let newPx = point.x;
//  ^hover

class Person {
    constructor(name) {
        this.name = name;
    }
    sayHello() {
        return 'Hi, I am ' + this.name;
    }
}

const me = new Person('Marios');
//    ^hover
//    ^def
//             ^hover
let myName = me.name;
//  ^hover
//           ^hover
let msg = me.sayHello();
//  ^hover
//           ^hover
//           ^def
