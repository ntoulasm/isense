// function foo() {
//     this.x = 2;
// }

// let x = new foo();
// x.z = 2;
// x.a = 5;
// x;

// class X {
//     y = 2;
//     constructor() {
//         this.x = 2;
//     }
//     getY() {
        
//     }
// }

// let x = new X();
// x.b = 2;


// let x = 2;


////////////////// free variables
// let global = 2;

// let x = function() {
//     global = 5;
// };

// global;

// x();

// global;


/////////////////// if else

// let global = 5;

// if(true) {
//     global = 2;
// } else if(true) {
//     global = ''
// } else if(true) {

// } else {
//     global = 100;
// }

// global;


///////////////// inference

// function computeMagnitude(p) {
//     p.magnitude = 13;
//     return p.x * p.x + p.y * p.y
// }

// let point = {x: 2, y: 3};
// let y = computeMagnitude(point);



// function foo2(a) {
//     // function foo3() {
//     //     return a + 2;
//     // }
//     return new foo3();
// };


// object free variables
// let global = {a: {b: 1}};

// function foo() {
//     global.c = 2;
//     global.a.b = {};
//     global.a.b.c = {};
//     global.a.b.c.d = {};
//     global.a.b.c.d.e = {};
//     global.a.b.c.d.e.f = 10;
//     global.b = 5;
// }



// foo();
// global;



// if(true) {
// 	x = 5;
// 	glob = 2;
// 	global.z = 5;
// } else if(false) {
// 	global.z = 2;
// 	glob = 12
// 	x = 10;
// } else {
// 	global.aaa = 5;
// 	glob = 15;
// 	x = 15;
// };

// global.a = 100;
// glob;

// {
// 	glob = 10000000;
// }

// {
//     var x = 10;
//     const y = 30;
//     {
//         var ooooo = 100;
//     }
// }
