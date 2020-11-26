import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { JftPage } from './jft.page';

const routes: Routes = [
  {
    path: '',
    component: JftPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class JftPageRoutingModule {}
