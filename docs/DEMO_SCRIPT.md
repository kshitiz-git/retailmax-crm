# Demo video script (1 min 50 s)

Record the live site https://kshitiz-git.github.io/retailmax-crm/ at 1440 × 900 in a fresh browser
window (or press "Reset demo" first). Speak the lines; the actions are in brackets. Times are a guide.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:12 | Dashboard | "This is RetailMax CRM. It loads 4,961 anonymised customers from dataset.csv and computes revenue, average order value, a 15.1% churn rate and consent share in the browser." |
| 0:12–0:27 | RFM Segments [scroll to the Recency × Frequency map] | "Each customer gets a recency, frequency and monetary score from 1 to 5 by quintile. The rule turns those scores into five segments: Champion, Loyal, New, At Risk and Lost." |
| 0:27–0:47 | Churn Prediction [show the model card, then the what-if simulator; drag "Days since last purchase" right] | "A logistic regression model trained in Python with scikit-learn scores every customer. On 993 held-out customers it reaches ROC-AUC 0.81 and recall 73%. If I raise the days since the last purchase, the risk goes up and the bars show why." |
| 0:47–1:02 | Customers → C00042 | "The customer 360 view shows lifetime value, RFM scores, churn probability with its top reasons, and a recommended next action." [Click Award / redeem points, enter 2000, Award] "Awarding 2,000 points moves this customer from Bronze to Silver." |
| 1:02–1:25 | Campaigns [click the At Risk win-back template, then Launch now] | "A campaign picks an audience by segment, region, age and risk. 1,445 customers match, but only the 1,173 who gave marketing consent are contacted; 272 are left out under the DPDP Act. The results show delivery, opens, clicks and conversions." |
| 1:25–1:37 | Sales Funnel | "The funnel shows how customers move from first purchase to repeat, regular, frequent and high-value buyers, by region." |
| 1:37–1:44 | Data Import / Export | "New customer files are validated row by row before they are merged; bad rows are listed with their line number." |
| 1:44–1:50 | Privacy & Consent | "Consent changes and erasure requests are logged. Code, notebook and report are on GitHub." |

Before recording: close other tabs, zoom 100%, hide bookmarks bar. After recording: trim to under 2 minutes.
