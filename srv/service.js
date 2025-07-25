const cds = require("@sap/cds");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage } = require("@langchain/core/messages");

require("dotenv").config();

module.exports = cds.service.impl(async function () {
  this.on("getFilteredRecords", async (req) => {
    const { entityName, prompt } = req.data;
    const entity = this.entities[entityName];

    if (!entity) {
      return req.error(404, `Entity ${entityName} not found.`);
    }

    if (!prompt) {
      const results = await SELECT.from(entity);
      return JSON.stringify(results);
    }

    // Global search for simple values
    if (prompt.split(" ").length === 1) {
      const entityDefinition = cds.model.definitions[entity.name];
      let allResults = [];
      const primaryKey = Object.keys(entityDefinition.elements).find(
        (key) => entityDefinition.elements[key].key
      );

     for (const key in entityDefinition.elements) {
        const element = entityDefinition.elements[key];
        let query;
        if (element.type === "cds.String") {
          query = SELECT.from(entity).where(`${key} like '%${prompt}%'`);
        } else if (
          (element.type === "cds.Integer" || element.type === "cds.Decimal") &&
          !isNaN(prompt)
        ) {
          query = SELECT.from(entity).where({ [key]: parseInt(prompt) });
        } else if (
          element.type === "cds.Date" &&
          /^\d{4}-\d{2}-\d{2}$/.test(prompt)
        ) {
          query = SELECT.from(entity).where({ [key]: prompt });
        } 

        if (query) {
          const results = await this.run(query);
          allResults.push(...results);
        }
      }

      // Remove duplicates
      const uniqueResults = allResults.filter(
        (v, i, a) => a.findIndex((t) => t[primaryKey] === v[primaryKey]) === i
      );

      return JSON.stringify(uniqueResults);
    }

    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: process.env.GOOGLE_API_KEY,
    });

    const entityDefinition = cds.model.definitions[entity.name];
    const properties = {};
    for (const key in entityDefinition.elements) {
      // Exclude association and composition properties
      if (
        !entityDefinition.elements[key].is2one &&
        !entityDefinition.elements[key].is2many
      ) {
        const element = entityDefinition.elements[key];
        if (element.type === "cds.Integer" || element.type === "cds.Decimal") {
            properties[key] = { type: "array", items: { type: "number" } };
        } else {
            properties[key] = { type: "array", items: { type: "string" } };
        }
      }
    }

    const extractionFunctionSchema = {
      name: "extractor",
      description: "Extracts filtering keywords from a user's prompt.",
      parameters: {
        type: "object",
        properties: properties,
      },
    };

    const runnable = llm.bindTools([extractionFunctionSchema], {
      tool_choice: { type: "function", function: { name: "extractor" } },
    });

    const message = new HumanMessage({
      content: `Extract filtering keywords from the following prompt: ${prompt}`,
    });

    const response = await runnable.invoke([message]);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      return [];
    }
    const keywords = response.tool_calls[0].args;
    console.log(keywords);
    
    let query = SELECT.from(entity);

    const whereClause = {};
    const stringConditions = [];

    for (const key in keywords) {
      if (keywords[key]) {
        const element = entityDefinition.elements[key];
        if (element.type === "cds.Integer" || element.type === "cds.Decimal") {
            if (Array.isArray(keywords[key])) {
                const numbers = keywords[key].map((val) => element.type === "cds.Integer" ? parseInt(val) : parseFloat(val)).filter(n => !isNaN(n));
                if (numbers.length > 0) {
                    whereClause[key] = { in: numbers };
                }
            } else {
                const number = element.type === "cds.Integer" ? parseInt(keywords[key]) : parseFloat(keywords[key]);
                if (!isNaN(number)) {
                    whereClause[key] = number;
                }
            }
        } else {
          if (Array.isArray(keywords[key])) {
            const orConditions = keywords[key].map((value) => {
              return `${key} like '%${value}%'`;
            });
            if (orConditions.length > 0) {
                stringConditions.push(`(${orConditions.join(" or ")})`);
            }
          } else {
            stringConditions.push(`${key} like '%${keywords[key]}%'`);
          }
        }
      }
    }

    if (Object.keys(whereClause).length > 0) {
      query.where(whereClause);
    }

    if (stringConditions.length > 0) {
        query.where(stringConditions.join(" and "));
    }

    const results = await this.run(query);
    return JSON.stringify(results);
  });
});
