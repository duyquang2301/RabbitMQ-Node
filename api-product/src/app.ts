import * as express from "express";
import { Request, Response } from "express";
import * as cors from "cors";
import { createConnection } from "typeorm";
import { Product } from "./entity/product";
import * as amqp from "amqplib/callback_api";

createConnection().then((connection) => {
  const productRepository = connection.getMongoRepository(Product);

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

      channel.assertQueue("product_created", { durable: false });
      app.use(express.json());

      channel.consume("product_created", (msg) => {
        const eventProduct: Product = JSON.parse(msg.content.toString());
        const product = new Product();
        product.admin_id = parseInt(eventProduct.id);
        product.title = eventProduct.title;
        product.image = eventProduct.image;
        product.likes = eventProduct.likes;

        productRepository.save(product);
      });

      app.get("/api/products", async (req: Request, res: Response) => {
        const products = await productRepository.find();
        res.send(products);
      });

      const port = 8001;
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
