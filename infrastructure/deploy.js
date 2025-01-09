const AWS = require("aws-sdk");
const fs = require("fs");
const createLambdaPackage = require("./create_zip");

// Set the profile
AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: "mazikmat" });

AWS.config.update({ region: "eu-north-1" });

const LAMBDA_NAME = "MyCronJobLambda";
const ROLE_ARN = "arn:aws:iam::682033489575:role/AWSLambdaBasicExecutionRole_Custom_MM";
const SCHEDULE_EXPRESSION = "cron(40 10 * * ? *)"; // 11:40 Uhr

const lambda = new AWS.Lambda();
const events = new AWS.EventBridge();





// Deploy the Lambda function
const deployLambda = async (zipPath) => {
    try {
        const zipFile = fs.readFileSync(zipPath);
        await lambda
            .createFunction({
                FunctionName: LAMBDA_NAME,
                Runtime: "nodejs18.x",
                Role: ROLE_ARN,
                Handler: "lambda_function.handler",
                Code: { ZipFile: zipFile },
                Description: "Lambda function to replicate a cron job",
                Timeout: 60,
                MemorySize: 128,
            })
            .promise();
        console.log(`Lambda ${LAMBDA_NAME} created successfully!`);
    } catch (err) {
        if (err.code === "ResourceConflictException") {
            console.log(`Lambda ${LAMBDA_NAME} already exists. Updating...`);
            const zipFile = fs.readFileSync(zipPath);
            await lambda
                .updateFunctionCode({
                    FunctionName: LAMBDA_NAME,
                    ZipFile: zipFile,
                })
                .promise();
            console.log(`Lambda ${LAMBDA_NAME} updated successfully!`);
        } else {
            console.error("Error deploying Lambda:", err);
        }
    }
};

// Create an EventBridge rule
const createEventBridgeRule = async () => {
    try {
        const ruleResponse = await events
            .putRule({
                Name: `${LAMBDA_NAME}-schedule`,
                ScheduleExpression: SCHEDULE_EXPRESSION,
                State: "ENABLED",
            })
            .promise();

        console.log(`EventBridge rule created: ${ruleResponse.RuleArn}`);

        // Add Lambda as the target
        const lambdaArn = (
            await lambda.getFunction({ FunctionName: LAMBDA_NAME }).promise()
        ).Configuration.FunctionArn;

        await events
            .putTargets({
                Rule: `${LAMBDA_NAME}-schedule`,
                Targets: [
                    {
                        Id: "1",
                        Arn: lambdaArn,
                    },
                ],
            })
            .promise();

        // Grant permissions for EventBridge to invoke Lambda
        const timestamp = new Date().toISOString().replace(/[^\w\-]/g, '');  // Remove non-alphanumeric characters
        await lambda
            .addPermission({
                FunctionName: LAMBDA_NAME,
                StatementId: `AllowEventBridgeInvoke-${timestamp}`,  // Unique StatementId with timestamp
                Action: "lambda:InvokeFunction",
                Principal: "events.amazonaws.com",
                SourceArn: ruleResponse.RuleArn,
            })
            .promise();

        console.log(`EventBridge rule linked to Lambda ${LAMBDA_NAME}`);
    } catch (err) {
        console.error("Error creating EventBridge rule:", err);
    }
};

// Main deployment function
const deploy = async () => {
    const zipPath = createLambdaPackage();
    await deployLambda(zipPath);
    await createEventBridgeRule();
    console.log("Deployment completed!");
};

deploy().catch((err) => console.error("Deployment failed:", err));
