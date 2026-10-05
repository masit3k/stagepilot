# Architecture

* [PDF input numbering rules](pdf-input-numbering.md) - Descriptive record of how buildDocument numbers PDF input channels: mono and stereo numbering, odd-start stereo, spare channels and compact stereo rows.
* [PDF rendering pipeline](pdf-rendering-pipeline.md) - Descriptive map of the implemented PDF pipeline from project JSON through buildDocument and validation to HTML rendering and Puppeteer output, with where each responsibility lives.
* [Project model (StagePilot)](project-model.md) - Model `Project` jako účel stageplanu: explicitní rozlišení typů `event` a `generic`, jejich metadata a pole rozhraní `Project`.
