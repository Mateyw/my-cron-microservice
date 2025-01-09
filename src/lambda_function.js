exports.handler = async (event) => {
    console.log("Cron job task executed", new Date().toISOString());
    
    return {
        statusCode: 200,
        body: JSON.stringify("Task completed!"),
    };
};
