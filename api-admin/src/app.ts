import * as express from "express";
import { Request, Response } from "express";
import * as cors from "cors";
import { createConnection } from "typeorm";
import { Product } from "./entity/product";
import * as amqp from "amqplib/callback_api";
import { json } from "stream/consumers";

createConnection().then((db) => {
  const productRepository = db.getRepository(Product);

  amqp.connect("amqps", (error0, connection) => {
    if (error0) {
      throw error0;
    }

    connection.createChannel((error1, channel) => {
      if (error1) {
        throw error1;
      }

      const app = express();

      app.use(
        cors({
          origin: [
            "http://localhost:3000",
            "http://localhost:8080",
            "http://localhost:4200",
          ],
        })
      );

      app.use(express.json());

      app.get("/api/products", async (req: Request, res: Response) => {
        const products = await productRepository.find();
        channel.sendToQueue("hello", Buffer.from("Hello World!"));
        res.json(products);
      });

      app.post("/api/products", async (req: Request, res: Response) => {
        const product = productRepository.create(req.body);
        const result = await productRepository.save(product);
        channel.sendToQueue(
          "product_created",
          Buffer.from(JSON.stringify(result))
        );
        res.send(result);
      });

      app.get("/api/products/:id", async (req: Request, res: Response) => {
        const product = await productRepository.findOne({
          where: { id: parseInt(req.params.id, 10) },
        });
        res.send(product);
      });

      app.put("/api/products/:id", async (req: Request, res: Response) => {
        const product = await productRepository.findOne({
          where: { id: parseInt(req.params.id, 10) },
        });
        productRepository.merge(product, req.body);
        const result = await productRepository.save(product);
        channel.sendToQueue(
          "product_updated",
          Buffer.from(JSON.stringify(result))
        );
        res.send(result);
      });

      app.delete("/api/products/:id", async (req: Request, res: Response) => {
        const result = await productRepository.delete(req.params.id);

        channel.sendToQueue(
          "product_deleted",
          Buffer.from(JSON.stringify(result))
        );
        res.send(result);
      });

      app.post(
        "/api/products/:id/like",
        async (req: Request, res: Response) => {
          const product = await productRepository.findOne({
            where: { id: parseInt(req.params.id, 10) },
          });
          product.likes++;
          const result = await productRepository.save(product);
          res.send(result);
        }
      );

      const port = 8000;
      app.listen(port, () => {
        console.log(`Listening on port: ${port}`);
      });
      process.on("exit", () => {
        console.log("Closing connection");
        connection.close();
      });
    });
  });
});
