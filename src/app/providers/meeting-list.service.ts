import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { HTTP } from '@ionic-native/http/ngx';

@Injectable()
export class MeetingListProvider {

  tomatoBMLT = 'https://tomato.bmltenabled.org/main_server/client_interface/json/';
  virtualBMLT = 'https://bmlt.virtual-na.org/main_server/client_interface/json/';
  getApiUrlVirt = 'https://bmlt.virtual-na.org/main_server/client_interface/json/?switcher=GetSearchResults&sort_keys=weekday_tinyint,start_time';
  getAllVirtMtgs = 'https://bmlt.virtual-na.org/main_server/client_interface/json/?switcher=GetSearchResults&data_field_key=location_postal_code_1,duration_time,start_time,time_zone,weekday_tinyint,service_body_bigint,longitude,latitude,location_province,location_municipality,location_street,location_info,location_text,location_neighborhood,formats,format_shared_id_list,comments,meeting_name,location_sub_province,worldid_mixed,root_server_uri,id_bigint,meeting_name,location_text,formatted_address,formatted_location_info,formatted_comments,contact_name_1,contact_phone_1,contact_email_1,contact_name_2,contact_phone_2,contact_email_2&services[]=4&recursive=1&sort_keys=start_time';

  constructor(
    private http: HttpClient,
    private httpCors: HTTP
  ) {

  }


  async getVirtualMeetings() {
    const data = await this.httpCors.get(this.getApiUrlVirt, {}, {});
    return JSON.parse(data.data);
  }


  async getAllVirtualMeetings() {
    const data = await this.httpCors.get(this.getAllVirtMtgs, {}, {});
    return JSON.parse(data.data);
  }


  getAutoRadiusMeetings(lat, long, radius) {
    const getAutoRadiusMeetingsURL: string = this.tomatoBMLT
      + '?switcher=GetSearchResults&geo_width_km='
      + '-'
      + radius
      + '&long_val='
      + long
      + '&lat_val='
      + lat
      + '&sort_keys=longitude,latitude&callingApp=bmlt_search_3_ionic';
    return this.http.get(getAutoRadiusMeetingsURL);
  }

  getRadiusMeetings(lat, long, radius) {
    const getRadiusMeetingsURL: string = this.tomatoBMLT
      + '?switcher=GetSearchResults'
      + '&data_field_key=longitude,latitude,id_bigint'
      + '&geo_width_km='
      + radius
      + '&long_val='
      + long
      + '&lat_val='
      + lat
      + '&sort_keys=longitude,latitude&callingApp=bmlt_search_3_ionic';
    return this.http.get(getRadiusMeetingsURL);
  }

  getAddressMeetings(lat, long, radius) {
    const getAddressMeetingsURL: string = this.tomatoBMLT
      + '?switcher=GetSearchResults&geo_width_km='
      + '-'
      + radius
      + '&long_val='
      + long
      + '&lat_val='
      + lat
      + '&sort_keys=longitude,latitude&callingApp=bmlt_search_3_ionic';
    return this.http.get(getAddressMeetingsURL);
  }

  getNearestMeeting(lat, long) {
    const getAddressMeetingsURL: string = this.tomatoBMLT
      + '?switcher=GetSearchResults&geo_width_km='
      + '-1'
      + '&long_val='
      + long
      + '&lat_val='
      + lat
      + '&sort_keys=longitude,latitude&callingApp=bmlt_search_3_ionic';
    return this.http.get(getAddressMeetingsURL);
  }

  getMeetingsByAreaProvider(areaID) {
    const getMeetingsByAreaURL: string = this.tomatoBMLT
      + '?switcher=GetSearchResults&services='
      + areaID
      + '&sort_keys=weekday_tinyint,start_time&callingApp=bmlt_search_3_ionic';
    return this.http.get(getMeetingsByAreaURL);

  }

  async getMeetingsByVirtArea(areaID) {
    const getMeetingsByVirtAreaURL: string = this.virtualBMLT
      + '?switcher=GetSearchResults&services='
      + areaID
      + '&sort_keys=weekday_tinyint,start_time&callingApp=bmlt_search_3_ionic';

    const data = await this.httpCors.get(getMeetingsByVirtAreaURL, {}, {});
    return JSON.parse(data.data);
  }

  getSingleMeetingByID(id) {
    const getSingleMeetingByIDURL: string = this.tomatoBMLT
      + '?switcher=GetSearchResults&meeting_ids[]='
      + id;
    return this.http.get(getSingleMeetingByIDURL);
  }

}
