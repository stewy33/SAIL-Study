const path = require("path")
const HtmlWebPackPlugin = require("html-webpack-plugin")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')

const isProduction = process.env.NODE_ENV === "production"

module.exports = {
  devtool: "source-map",
  entry: path.resolve(__dirname, "frontend/index.js"),
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "bundle.js",
  },
  resolve: {
    modules: [path.join(__dirname, "frontend"), "node_modules"],
    alias: {
      react: path.join(__dirname, "node_modules", "react"),
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.less$/,
        use: [
          isProduction ? MiniCssExtractPlugin.loader : "style-loader",
          "css-loader",
          {
            loader: "less-loader",
            options: { lessOptions: { javascriptEnabled: true } },
          },
        ],
      },
      {
        test: /\.html$/,
        use: [{ loader: "html-loader" }],
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: [{
            loader: 'file-loader',
            options: {}
        }]
      },
    ],
  },
  plugins: [
    new HtmlWebPackPlugin({
      template: "./frontend/index.html"
    }),
    new FaviconsWebpackPlugin('./frontend/images/favicon.png') 
  ],
}
