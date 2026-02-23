{
    const x = 5 + 2, y = 2;

    x = 5;
//  ^hover
//  ^def
}


{
    const x = 1, y = 2;

    y = 10;
//  ^hover
//  ^def
}

{
    const x = 1, y = 2, z = 3;


    z = 100;
    y = 100;
}