namespace promptfilter;

entity Customers {
  key ID       : Integer;
  name         : String(100);
  email        : String(100);
  phone        : String(20);
  address      : String(100);
  city         : String(50);
  state        : String(50);
  country      : String(50);
  joinDate     : Date;

  orders       : Composition of many Orders on orders.customer = $self;
}

entity Products {
  key ID          : Integer;
  name            : String(100);
  description     : String(200);
  category        : String(50);
  price           : Decimal(9,2);
  stock           : Integer;
  createdDate     : Date;
}

entity Orders {
  key ID              : Integer;
  customer            : Association to Customers;
  product             : Association to Products;
  orderDate           : Date;
  quantity            : Integer;
  amount              : Decimal(13,2);
  status              : String(20);
  shippingAddress     : String(200);
  shippedDate         : Date;
}