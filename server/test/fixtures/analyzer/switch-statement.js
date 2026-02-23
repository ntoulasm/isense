let x=100, a, b;
switch (a) {
    case 1:
        x = 2; break;
    case 2:
        if (b) x = 5; break;
    case (x = 'foo'): 
        x = 'bar'; break;
}

x
//^hover