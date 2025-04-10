import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { StepWorkingGuidesPage } from './step-working-guides.page';

const routes: Routes = [
  {
    path: '',
    component: StepWorkingGuidesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StepWorkingGuidesPageRoutingModule {}
