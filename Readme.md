# MirrorGate Cloudwatch Metrics Collector

![MirrorGate](media/images/logo-mirrorgate.png)

This Node application connects to Amazon Cloudwatch and retrieves metrics about the number of requests, the number of healthy checks, 4XX and 5XX errors occurred in a Load Balancer (Classic or Application LB).

## Configuring

Check [config.js](./src/config/config.js) file to check for configuration options.

The CloudWatch Metrics Collector works with the assumption that MirrorGate endpoint is configured as environment variable.

```text
MIRRORGATE_ENDPOINT
```

If not, default endpoint defined in properties will be used.

The collector will filter the results and will only take the ones that come with the AWS/ prefix. The expected info from the GET endpoint
should follow this pattern:

```text
AWS/{AWS_Account}/{LB_name}
```

## AWS roles and policies needed

Since this collector is intended to gather information from different CloudWatch sources, we need to make sure that
we have permission to access those sources. To make this information accessible for the collection, the account where
CloudWatch is running we need to create the following role on that account:

**delegated-cloudwatch-metrics-role**

with the following trust relationship:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::{AWS_Account}:role/{role}",
          "arn:aws:iam::{AWS_Account}:user/{UserId}"
        ]
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

and a policy that allows that role to access the following resources

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "apigateway:GET",
                "cloudwatch:getMetricStatistics",
                "elasticloadbalancing:DescribeLoadBalancers",
                "ce:GetCostAndUsage",
                "elasticloadbalancing:DescribeTargetGroups"
            ],
            "Resource": [
                "*"
            ]
        }
    ]
}
```

Note that the permissions can be fine grained to allow only queries to the methods and resources employed.
This allows the user or role used for running the code to impersonate a user in the receiving account and perform the queries to Cloudwatch.

- _{AWS_Account}_ : Refers to the Amazon account number from where the code is being executed.
- _{role}_: Refers to the Amazon role used by the code collector code.
- _{UserId}_: Refers to the Amazon user id used by the code collector code.

## Usage

First install dependencies

```sh
  npm i
```

You need to install AWS CLI and configure it with your user. Then you can assume _delegated-cloudwatch-metrics-role_
in your local machine with the following command:

```sh
aws sts assume-role --profile {local_profile} --role-arn arn:aws:iam::{Destination_AWS_account_number}:role/delegated-cloudwatch-metrics-role --role-session-name test_delegated
```

Then run `index.js` with npm

```sh
  npm start
```

## Running in Amazon Lambda

First package script zip with the following npm command

```sh
npm run package
```

Create a lambda with runtime Node.js 6.10 or grater and following handler `lambda.handler`. Note it will execute only once, so you will have to use a timed trigger to execute it eventually.
