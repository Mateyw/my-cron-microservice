// Create a zip package for the Lambda function
const path = require("path");

const createLambdaPackage = () => {
    const zipPath = path.join(__dirname, "function.zip");
    const zip = new require("adm-zip")();
    zip.addLocalFile(path.join(__dirname, "../src/lambda_function.js"));
    zip.writeZip(zipPath);
    return zipPath;
};

module.exports = createLambdaPackage;
