import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { HowAndWhyPage } from './how-and-why.page';

const routes: Routes = [
  {
    path: '',
    component: HowAndWhyPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HowAndWhyPageRoutingModule {}
