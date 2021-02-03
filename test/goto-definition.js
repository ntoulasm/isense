// let x = 2;

// function foo() {
//     let x = 2;
// }

// let y = () => {
//     let zzzz = 'haha';
// };

// foo();

// x;

// y;

function createPoint(x, y) {
    
    const point = {};

    point.x = x;
    point.y = y;
    
    return point;

}

function createLine(beginX, beginY, endX, endY) {
    
    const line = {};

    line.begin = createPoint(beginX, beginY);
    line.end = createPoint(endX, endY);

    return line;

}

function createCircle(centerX, centerY, radius) {

    const circle = {};

    circle.center = createPoint(centerX, centerY);
    circle.radius = radius;

    circle.area = () => {
        const area = Math.PI * radius * radius;
        return area;
    };

    return circle;

}

function createRectangle(x, y, width, height) {

    const rectangle = {};

    rectangle.topLeft = createPoint(x, y);
    rectangle.width = width;
    rectangle.height = height;

    rectangle.area = () => {
        const area = width * height;
        return area;
    };

    return rectangle;

}

function createBox(x, y, width) {
    const box = createRectangle(x, y, width, width);
    return box;
}

const ShapeType = {
    Point: 0,
    Line: 1,
    Circle: 2
};

function createRandomShapes(total) {

    const shapes = [];
    
    for(let i = 0; i < total; ++i) {
        switch(random) {
            case 0: {
                shapes.push(createCircle());
                break;
            }
        }
    }

    return shapes;

}

class Animal {

    name;
    age;

    speak() {

    };

    walk() {
        
    }

    sleep() {

    }

    set name() {

    }

    get name() {

    }

    set age() {

    }

    get age() {

    }

}

const shapes = createRandomShapes(100);
