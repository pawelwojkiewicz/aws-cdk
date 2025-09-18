import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import * as path from 'node:path';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

// ✅ KROK 1: Tworzymy nowy "typ" dla naszych właściwości.
// Mówimy: "Nasze właściwości to wszystko to, co ma standardowy StackProps, PLUS nasza własna właściwość 'stage'".
export interface CloudStackProps extends StackProps {
  readonly stage: string;
}

export class CloudStack extends Stack {
  // ✅ KROK 2: Modyfikujemy konstruktor, aby akceptował nasz nowy typ 'CloudStackProps'.
  constructor(scope: Construct, id: string, props: CloudStackProps) {
    super(scope, id, props);

    const stage = props.stage;
    // ===================================================================================
    // ## 1. Definicja S3 Bucket do przechowywania plików aplikacji Angulara
    // ===================================================================================
    const websiteBucket = new s3.Bucket(this, `AwsCDKWebsiteBucket-${stage}`, {
      // Dostęp do plików będzie realizowany wyłącznie przez CloudFront,
      // dlatego bucket nie musi być publicznie dostępny. To bezpieczniejsze.
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

      // Te dwie opcje są przydatne w dewelopmencie:
      // Po usunięciu stacka (cdk destroy), bucket zostanie automatycznie usunięty...
      removalPolicy: RemovalPolicy.DESTROY,
      // ...a przed usunięciem zostanie automatycznie opróżniony z plików.
      autoDeleteObjects: true,
    });

    // ## 2. Definicja Tabeli DynamoDB do przechowywania wiadomości
    // ===================================================================================
    const messagesTable = new dynamodb.Table(this, `AwsCDKMessagesTable-${stage}`, {
      // "Klucz partycji" to unikalny identyfikator każdego rekordu.
      // W naszym przypadku email będzie dobrym identyfikatorem.
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },

      // Tryb rozliczeń "na żądanie" - płacisz tylko za to, czego faktycznie użyjesz.
      // Idealne dla nowych projektów.
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

      // Tak jak w przypadku S3, ta opcja usuwa tabelę po zniszczeniu stacka.
      // Wygodne w dewelopmencie.
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ===================================================================================
    // ## 3. Definicja Funkcji Lambda i nadanie jej uprawnień
    // ===================================================================================

    const contactLambda = new NodejsFunction(this, `AwsCDKContactLambda-${stage}`, {
      runtime: Runtime.NODEJS_LATEST,
      // Wskazujemy bezpośrednio na plik źródłowy TypeScript
      entry: path.join(__dirname, '..', 'lambdas', 'contact-form.ts'),
      handler: 'handler', // Nazwa eksportowanej funkcji
      environment: {
        TABLE_NAME: messagesTable.tableName,
        SENDER_EMAIL: 'p.wojkiewicz@gmail.com',
      },
      // NodejsFunction automatycznie zarządza zależnościami
      bundling: {
        externalModules: ['aws-sdk'], // Wykluczamy aws-sdk, bo jest wbudowane w Lambdę
      },
    });

    // Dajemy Lambdzie uprawnienia do zapisu w naszej tabeli DynamoDB
    messagesTable.grantWriteData(contactLambda);

    // Dajemy Lambdzie uprawnienia do wysyłania e-maili przez SES
    contactLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail'],
        resources: ['*'], // '*' jest OK do nauki, w produkcji można zawęzić
        effect: iam.Effect.ALLOW,
      }),
    );

    // ## 4. Definicja API Gateway
    const api = new apigateway.LambdaRestApi(this, `AwsCDKContactLambda-${stage}`, {
      handler: contactLambda,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST'],
      },
    });

    // ===================================================================================
    // ## 3. Definicja Dystrybucji CloudFront (CDN)
    // ===================================================================================
    const distribution = new cloudfront.Distribution(this, `AwsCDKDistribution-${stage}`, {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket),
        // Przekierowuj cały ruch z http na https
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      // Domyślny plik, który ma być serwowany (dla Angulara to zawsze index.html)
      defaultRootObject: 'index.html',

      // BARDZO WAŻNE dla aplikacji typu Single Page Application (jak Angular):
      // Przekierowuje wszystkie błędy 403/404 na index.html. To pozwala,
      // aby routing Angulara przejął kontrolę i poprawnie wyświetlał podstrony.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // ===================================================================================
    // ## 4. Automatyczny Deployment plików z /dist do S3
    // ===================================================================================
    new s3deploy.BucketDeployment(this, `AwsCDKDeployWebsite-${stage}`, {
      // Źródło: wskaż folder, w którym Angular buduje Twoją aplikację.
      // Upewnij się, że 'nazwa-twojego-projektu-angular' jest poprawna!
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '..', '..', 'dist', 'aws-cdk-iac', 'browser')),
      ],

      // Cel: bucket, który zdefiniowaliśmy wyżej.
      destinationBucket: websiteBucket,

      // Po wgraniu nowych plików, unieważnij cache w CloudFront,
      // aby użytkownicy od razu zobaczyli nową wersję strony.
      distribution: distribution,
      distributionPaths: ['/*'],
    });

    // ===================================================================================
    // ## 7. Wyświetlenie adresu URL naszej strony w terminalu po wdrożeniu
    // ## Outputs - Używamy 'stage' do tworzenia unikalnych nazw outputów
    // ===================================================================================
    new CfnOutput(this, `CloudFrontURL-${stage}`, {
      value: `https://${distribution.distributionDomainName}`,
      description: `The distribution URL for the ${stage} stage`,
    });

    new CfnOutput(this, `ApiUrl-${stage}`, {
      value: api.url,
      description: `The API URL for the ${stage} stage`,
    });
  }
}
