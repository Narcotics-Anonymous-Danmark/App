import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BasicTextPage } from './basic-text.page';

const routes: Routes = [
  {
    path: '',
    component: BasicTextPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BasicTextPageRoutingModule {}
