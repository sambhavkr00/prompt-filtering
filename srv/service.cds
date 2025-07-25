using { promptfilter as my } from '../db/src/schema';

service CatalogService {
  entity Customers @readonly as projection on my.Customers;
  entity Products @readonly as projection on my.Products;
  entity Orders @readonly as projection on my.Orders;

  action getFilteredRecords(entityName: String, prompt : String) returns cds.LargeString;
}
