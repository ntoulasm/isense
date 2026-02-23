let x = {
    a : -1,
    b : "sqr",
    c : false 
};
//^hover

x.d = {};
//^hover
x.d.foo = 3.14;
//  ^hover
x.d.bar = "world";
//  ^hover
/*let x = {
    a: 2
};

let y = x;
x.b = {};
y.b.b = {};
x.b.b.c = 2;
y;*/

