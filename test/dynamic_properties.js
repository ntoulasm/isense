let x = {
    a: 2
};

let y = x;
x.b = {};
y.b.b = {};
x.b.b.c = 2;
y;

// -----------------------------------------------------------------------

function a(b) {
    b.kakak = 1000;
    return b;
}

let k = a(x);

// -----------------------------------------------------------------------

class poi {
    a;
    constructor (x, y) {
        this.x = x;
        this.y = y;
    }
    magnitude() {

    }
}

const point = new poi(1, 2);
point.x;

// -----------------------------------------------------------------------

// let empty1 = {};
// let empty2 = {};

// let isEqual = empty1 == empty1;

// -----------------------------------------------------------------------

// function createPoint2D(x, y) {
//     return { x, y };
// }

// function makePoint3D(point) {
//     point.z = 0;
// }

// const point = createPoint2D(5, 5);
// makePoint3D(point);
