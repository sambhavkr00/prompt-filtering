sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
  ],
  (Controller, MessageBox, JSONModel) => {
    "use strict";

    return Controller.extend("filteringapp.controller.CustomersList", {
      onInit() {
        const oEntityModel = new sap.ui.model.json.JSONModel({
          entities: [
            { name: "Customers" },
            { name: "Products" },
            { name: "Orders" },
          ],
        });
        this.getView().setModel(oEntityModel, "entityModel");

        const oTitleModel = new sap.ui.model.json.JSONModel({
          title: "Customers List",
        });
        this.getView().setModel(oTitleModel, "titleModel");

        // Set default entity
        this.sSelectedEntity = "Customers";
        this._bInitialLoad = true;
      },

      onAfterRendering: function () {
        if (this._bInitialLoad) {
          this._triggerFilter();
          this._bInitialLoad = false;
        }
      },

      onEntityChange: function (oEvent) {
        this.sSelectedEntity = oEvent.getParameter("selectedItem").getKey();
        this.getView()
          .getModel("titleModel")
          .setProperty("/title", this.sSelectedEntity + " List");
        this._triggerFilter();
      },

      _triggerFilter: function () {
        const sPrompt = this.getView().byId("filterInput").getValue().trim();
        const oTable = this.getView().byId("listTable");
        const oView = this.getView();
        oView.setBusy(true);

        const oModel = this.getOwnerComponent().getModel();
        const oAction = oModel.bindContext("/getFilteredRecords(...)");
        oAction.setParameter("entityName", this.sSelectedEntity);
        oAction.setParameter("prompt", sPrompt);
        oAction
          .execute()
          .then(() => {
            const oResult = oAction.getBoundContext().getObject();
            const aItems = JSON.parse(oResult.value);
            const oJsonModel = new sap.ui.model.json.JSONModel();
            oJsonModel.setData({ items: aItems });
            oTable.setModel(oJsonModel, "tableModel");

            // Dynamically create columns
            oTable.destroyColumns();
            if (aItems.length > 0) {
              const oFirstItem = aItems[0];
              for (const key in oFirstItem) {
                oTable.addColumn(
                  new sap.m.Column({
                    header: new sap.m.Text({ text: key }),
                  })
                );
              }

              // Dynamically create cells
              const oTemplate = new sap.m.ColumnListItem();
              for (const key in oFirstItem) {
                oTemplate.addCell(
                  new sap.m.Text({ text: "{tableModel>" + key + "}" })
                );
              }
              oTable.bindItems("tableModel>/items", oTemplate);
            }

            if (aItems.length === 0) {
              MessageBox.information(
                this.getView()
                  .getModel("i18n")
                  .getResourceBundle()
                  .getText("notFoundMessage")
              );
            }
          })
          .catch((oError) => {
            console.error("Error calling getFilteredRecords action:", oError);
            oTable.setModel(new sap.ui.model.json.JSONModel({ items: [] }));
          })
          .finally(() => {
            oView.setBusy(false);
          });
      },

      onFilter: function () {
        this._triggerFilter();
      },
    });
  }
);
