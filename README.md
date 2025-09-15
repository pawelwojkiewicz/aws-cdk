Aplikacja Full-Stack z AWS CDK (IaC)
Projekt ten demonstruje budowę i wdrożenie kompletnej, serwerlessowej aplikacji webowej (Angular + Node.js) w chmurze AWS. Cała infrastruktura – od hostingu frontendu po logikę backendu – jest zdefiniowana jako kod (IaC - Infrastructure as Code) za pomocą biblioteki AWS CDK w języku TypeScript.

Aplikacja składa się z formularza kontaktowego, który pozwala użytkownikom na wysłanie wiadomości. Dane są zapisywane w bazie danych DYNAMO DB, a na wskazany adres e-mail wysyłane jest powiadomienie poprzez serwis Amazon SES (Simple Email Service).

## 🚀 Stworzona Infrastruktura
W ramach projektu, za pomocą kodu, zostały stworzone i skonfigurowane następujące zasoby AWS:

## 🛠️ Użyte Technologie
Frontend: Angular

Backend: Node.js, TypeScript

Infrastruktura jako Kod (IaC): AWS CDK (Cloud Development Kit) v2

Baza Danych: Amazon DynamoDB

API: Amazon API Gateway

Hosting: Amazon S3 & Amazon CloudFront

Powiadomienia: Amazon SES

Logika serwerlessowa: AWS Lambda


### Frontend Hosting:

- S3 Bucket: Prywatny bucket do bezpiecznego przechowywania statycznych plików aplikacji Angular.

- CloudFront: Globalna sieć CDN, która udostępnia aplikację użytkownikom na całym świecie z niskim opóźnieniem i darmowym certyfikatem SSL (HTTPS).

### Backend API:

- API Gateway: Publiczny endpoint REST API, który przyjmuje zapytania POST z formularza.

- Funkcja Lambda: Logika backendu napisana w Node.js (TypeScript), która:

  - Przetwarza dane z formularza.

  - Zapisuje wiadomość w bazie danych.

  - Wysyła powiadomienie e-mail.

- DynamoDB: W pełni zarządzana i skalowalna baza danych NoSQL do przechowywania wiadomości.

- Amazon SES (Simple Email Service): Usługa do wysyłania powiadomień e-mail.


## 🛠️ Proces Tworzenia (Krok po Kroku)

1. Oddzielenie Kodu Infrastruktury
   Na początku został stworzony dedykowany folder cloud/, aby logicznie oddzielić kod aplikacji od kodu definiującego infrastrukturę. To kluczowa, dobra praktyka.

2. Inicjalizacja Projektu CDK
   Wewnątrz folderu cloud/ został zainicjowany nowy projekt AWS CDK.

```cdk init app --language typescript```

3. Instalacja Biblioteki AWS CDK
   Została zainstalowana główna biblioteka aws-cdk-lib, która dostarcza tzw. Konstrukty (Constructs) – gotowe "klocki" do budowania zasobów AWS w kodzie.

```npm install aws-cdk-lib```

Dzięki tej bibliotece można w prosty sposób tworzyć zasoby, np. new s3.Bucket(...) czy new lambda.Function(...).

4. Przygotowanie Środowiska AWS (Bootstrap)
   Przed pierwszym wdrożeniem zostało przygotowane konto AWS w danym regionie. Komenda cdk bootstrap tworzy niezbędne zasoby "narzędziowe" (m.in. bucket S3 na assety i role IAM), które umożliwiają CDK bezpieczne zarządzanie infrastrukturą. Jest to operacja jednorazowa dla każdego regionu.

```cdk bootstrap```

5. Definicja Zasobów w Kodzie
   Cała architektura opisana powyżej została zdefiniowana jako kod w pliku ```cloud/lib/cloud-stack.ts```. To serce projektu IaC, które zawiera precyzyjne instrukcje, jak ma wyglądać każdy element chmury.

6. Stworzenie funkcji Lambda ( cała insrtukcja krok po kroku opisana w funkcji), która:
   - Przetwarza dane z formularza.
   - Zapisuje wiadomość w bazie danych.
   - Wysyła powiadomienie e-mail.

6. Wdrożenie na AWS
   Ostatnim krokiem było wdrożenie. Komenda cdk deploy uruchamia dwuetapowy proces:

### Faza 1: Synteza (na Twoim komputerze)

CDK tłumaczy kod TypeScript na szablon JSON, czyli plan zrozumiały dla AWS CloudFormation.

CDK pakuje lokalne zasoby (np. kod Lambdy, pliki Angulara z /dist) i wysyła je do "narzędziowego" bucketa S3 w chmurze.

### Faza 2: Wykonanie (w chmurze AWS)

Szablon JSON jest przekazywany do usługi AWS CloudFormation.

CloudFormation, działając jak kierownik budowy, czyta plan i krok po kroku tworzy lub aktualizuje wszystkie zasoby w AWS.



Główną zaletą podejścia IaC jest to, że całą infrastrukturę można zniszczyć jedną komendą (cdk destroy) i odtworzyć ją w kilka minut (cdk deploy), mając pewność, że za każdym razem będzie identyczna i poprawnie skonfigurowana.
