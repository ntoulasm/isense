// let x = 2;
// let y;
// x = 5;
// y = x;
// x = 3;
// y;

// if(true) {
//     x = "";
// } else {
//     x = 10;
// }
// x;

// if(!y) {
//     x = 2;
// }
// x;
// y
// function foo(a, b) {
//     let x;
//     if(a) {
//         x = 2;
//     } else if(true) {
//         x = 5;
//     } else if(b) {
//         x = 1;
//     } else {
//         x = 10;
//     }
//     x;
// }




// let x = 2 + 5;
// let y = x + 3;
// let z = x + y + 10;
// let foo = x + y + z + 100 - 2;
// foo = 2;
// let w = x++;
// let y = x;
// x + y + z;


// let x = 2;

// let y = function(a, b, c) {
//     return x;
// }

// let w = y();

// {
//     x = "hello";
// }

// let z = y();


//////////////////////////////////////////////////

// let x = 2;

// {
//     x = 'hello';
// }

// x;

// x = 5;


///////////////////////////////////////////////////

// let x = 5;
// let y = 2;
// let z = x + 6;
// {
//     {
//         z = 5;
//         {
//             z = 2;
//         }
//     }
// }
// z;

// ;

////////////////////////////////////////////////////

// let x = 2;

// if(a) {
//     x = 5;
// } else if (b) {
//     x = 6;
// } else {
//     x = 100;
//     if(a) {
//         x = 10;
//     } else {
//         x = 20;
//     }
// }

// x;

////////////////////////////////////////////////////

// let z = 10;

// function f() {
//     z = 2;
//     if(ggg) {
//         z = {a: {}};
//     }
// }

// (f()) + 2;
// z;

// let x = 5;

// let y = (x = 2) + (x = 4) + (x = 6);

//////////////////////////////////////////////////////

// function foo(a, b) {
//     a = 2;
//     return a + b;
// }

// // foo();
// let x = foo();

//////////////////////////////////////////////////////

// -----------------------------------------------------------------------

// class poi {
//     a;
//     constructor (x, y) {
//         this.x = x;
//         this.y = y;
//     }
//     magnitude() {

//     }
// }

// const point = new poi(1, 2);
// point.z = 100;

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

let foo;

if(a) {
    /**
     * @param {number} a
     * @param {number} b

     * @returns {number}
     */
    foo = (a, b) => {

    };
} else {
    foo = (a, b, c) => {

    };
}
